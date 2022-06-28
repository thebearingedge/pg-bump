import fs from 'fs'
import path from 'path'
import { PostgresError } from 'postgres'
import MigrationError from './migration-error'
import bootstrap, { BootstrapOptions, BootstrapResults } from './bootstrap'

type UpOptions = BootstrapOptions & {

}

type UpResults = BootstrapResults & {
  applied: string[]
}

export default async function up(options: UpOptions): Promise<UpResults> {

  const { isCorrupt, isSynchronized, ...results } = await bootstrap(options)

  if (isCorrupt || isSynchronized) return { ...results, applied: [], isCorrupt, isSynchronized }

  const [{ pending, schemaTable }, { sql, files }] = [results, options]

  for (const migration of pending) {
    const script = fs.readFileSync(path.join(files, migration, 'up.sql'), 'utf8')
    try {
      await sql.unsafe(script)
    } catch (err) {
      if (!(err instanceof PostgresError)) throw err
      const file = path.join(migration, 'up.sql')
      const lines = script.slice(0, Number(err.position)).split('\n')
      throw err instanceof PostgresError
        ? new MigrationError(err.message, file, lines.length, lines.join('\n') + '...')
        : err
    }
    await sql.unsafe(`
      insert into ${schemaTable} (version, migration)
      select max(version) + 1, '${migration}' from ${schemaTable};
    `)
  }

  return {
    ...results,
    applied: pending,
    pending: [],
    isCorrupt: false,
    isSynchronized: true
  }
}
