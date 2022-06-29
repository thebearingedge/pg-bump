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

  const { isCorrupt, ...results } = await bootstrap(options)

  const applied: Synced[] = []

  if (isCorrupt) return { ...results, applied, isCorrupt }

  const [{ pending, schemaTable }, { sql, files }] = [results, options]

  for (const { migration } of pending) {
    const script = fs.readFileSync(path.join(files, migration, 'up.sql'), 'utf8')
    try {
      await sql.unsafe(script)
    } catch (err) {
      if (!(err instanceof PostgresError)) throw err
      const file = path.join(migration, 'up.sql')
      throw MigrationError.fromPostgres(err, file, script)
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
    isCorrupt: false
  }
}
