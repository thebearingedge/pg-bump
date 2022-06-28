import fs from 'fs'
import path from 'path'
import { PostgresError } from 'postgres'
import MigrationError from './migration-error'
import bootstrap, { BootstrapOptions, BootstrapResults } from './bootstrap'

type DownOptions = BootstrapOptions & {
  to?: string
}

type DownResults = BootstrapResults & {
  reverted: string[]
}

export default async function down(options: DownOptions): Promise<DownResults> {

  const { isCorrupt, ...results } = await bootstrap(options)

  if (isCorrupt) return { ...results, reverted: [], isCorrupt }

  const [{ synced, schemaTable }, { sql, to = '', files }] = [results, options]

  const reverting = synced.slice(synced.indexOf(to) + 1).reverse()

  for (const migration of reverting) {
    const file = path.join(migration, 'down.sql')
    const script = fs.readFileSync(path.join(files, file), 'utf8')
    try {
      await sql.unsafe(script)
    } catch (err) {
      if (!(err instanceof PostgresError)) throw err
      const file = path.join(migration, 'down.sql')
      const lines = script.slice(0, Number(err.position)).split('\n')
      throw err instanceof PostgresError
        ? new MigrationError(err.message, file, lines.length, lines.join('\n') + '...')
        : err
    }
    await sql.unsafe(`
      delete
        from ${schemaTable}
       where migration = '${migration}'
    `)
  }

  return {
    ...results,
    reverted: reverting,
    isCorrupt: false,
    isSynchronized: true
  }
}
