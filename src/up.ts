import fs from 'fs'
import path from 'path'
import { PostgresError } from 'postgres'
import MigrationError from './migration-error'
import bootstrap, { StatusOptions, StatusResults, Synced } from './status'

type UpOptions = StatusOptions

type UpResults = StatusResults & {
  applied: Synced[]
}

export default async function up(options: UpOptions): Promise<UpResults> {

  const { isCorrupt, isSynchronized, ...results } = await bootstrap(options)

  const applied: Synced[] = []

  if (isCorrupt || isSynchronized) return { ...results, applied, isCorrupt, isSynchronized }

  const [{ pending, schemaTable }, { sql, files }] = [results, options]

  for (const { migration } of pending) {
    const script = fs.readFileSync(path.join(files, migration, 'up.sql'), 'utf8')
    try {
      await sql.unsafe(script)
    } catch (err) {
      if (!(err instanceof PostgresError)) throw err
      const file = path.join(migration, 'up.sql')
      const lines = script.slice(0, Number(err.position)).split('\n')
      throw new MigrationError(err.message, file, lines.length, lines.join('\n') + '...')
    }
    const [synced] = await sql.unsafe<[Synced]>(`
      insert into ${schemaTable} (version, migration)
      select max(version) + 1, '${migration}' from ${schemaTable}
      returning version,
                migration;
    `)
    applied.push(synced)
  }

  return {
    ...results,
    applied,
    pending: [],
    isCorrupt: false,
    isSynchronized: true
  }
}
