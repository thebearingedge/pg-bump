import fs from 'fs'
import path from 'path'
import { PostgresError } from 'postgres'
import MigrationError from './migration-error'
import bootstrap, { BootstrapOptions, BootstrapResults, Synced } from './bootstrap'

type DownOptions = BootstrapOptions & {
  to?: number
}

type DownResults = BootstrapResults & {
  reverted: Synced[]
}

export default async function down(options: DownOptions): Promise<DownResults> {

  const { isCorrupt, ...results } = await bootstrap(options)

  if (isCorrupt) return { ...results, reverted: [], isCorrupt }

  const [{ synced, schemaTable }, { sql, to = 0, files }] = [results, options]

  const reverting = synced
    .slice(synced.findIndex(({ version }) => version === to) + 1)
    .sort((a, b) => a.version > b.version ? -1 : 1)

  for (const { migration } of reverting) {
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
