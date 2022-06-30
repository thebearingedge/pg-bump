import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import postgres from 'postgres'
import { printMigrationErrorReport } from './migration-error.js'
import status, { StatusOptions, StatusResults, Synced } from './status.js'

type DownOptions = StatusOptions & {
  to?: number
  transaction?: boolean
}

type DownResults = StatusResults & {
  reverted: Synced[]
}

export default async function down(options: DownOptions): Promise<DownResults> {

  const { isError, summary, ...results } = await status(options)

  const reverted: Synced[] = []

  if (isError) return { isError, ...results, reverted, summary }

  const [{ synced, schemaTable }, { sql, files, to = 0, transaction = true }] = [results, options]

  const reverting = synced
    .slice(synced.findIndex(({ version }) => version === to) + 1)
    .sort((a, b) => a.version > b.version ? -1 : 1)

  for (const { migration } of reverting) {
    const file = path.join(migration, 'down.sql')
    const script = fs.readFileSync(path.join(files, file), 'utf8')
    try {
      await sql.unsafe(script)
    } catch (err) {
      if (!(err instanceof postgres.PostgresError)) throw err
      return {
        ...results,
        isError: true,
        reverted: transaction ? [] : reverted,
        summary: summary.concat({
          isError: true, message: printMigrationErrorReport(err, file, script)
        })
      }
    }
    const [notSynced] = await sql.unsafe<[Synced]>(`
      delete
        from ${schemaTable}
       where migration = '${migration}'
      returning version,
                migration
    `)
    reverted.push(notSynced)
  }

  return {
    ...results,
    isError: false,
    reverted,
    summary: summary.concat({ isError: false, message: printDownReport(reverting) })
  }
}

function printDownReport(reverted: Synced[]): string {
  if (reverted.length === 0) {
    return chalk.green('already at base migration')
  }
  const pluralized = reverted.length === 1 ? 'migration' : 'migrations'
  return [
    chalk.green(`reverted ${reverted.length} ${pluralized}`),
    ...reverted.map(({ version, migration }) => (
      chalk.cyan((String(version) + ':').padStart(9), chalk.white(migration))
    ))
  ].join('\n')
}
