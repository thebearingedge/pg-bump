import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import postgres from 'postgres'
import { printMigrationErrorReport } from './migration-error.js'
import bootstrap, { StatusOptions, StatusResults, Synced } from './status.js'

type UpOptions = StatusOptions & {
  transaction?: boolean
}

type UpResults = StatusResults & {
  applied: Synced[]
}

export default async function up(options: UpOptions): Promise<UpResults> {

  const { isError, summary, ...results } = await bootstrap(options)

  const applied: Synced[] = []

  if (isError) return { isError, ...results, applied, summary }

  const [{ pending, schemaTable }, { sql, files, transaction = true }] = [results, options]

  for (const { migration } of pending) {
    const file = path.join(migration, 'up.sql')
    const script = fs.readFileSync(path.join(files, file), 'utf8')
    try {
      await sql.unsafe(script)
    } catch (err) {
      if (!(err instanceof postgres.PostgresError)) throw err
      return {
        ...results,
        isError: true,
        applied: transaction ? [] : applied,
        summary: summary.concat({
          isError: true, message: printMigrationErrorReport(err, file, script)
        })
      }
    }
    const [synced] = await sql.unsafe<[Synced]>(`
      insert into ${schemaTable} (version, migration)
      select max(version) + 1,
             '${migration}'
        from ${schemaTable}
      returning version,
                migration
    `)
    applied.push(synced)
  }

  return {
    ...results,
    isError: false,
    applied,
    pending: [],
    summary: summary.concat({ isError: false, message: printUpReport(applied) })
  }
}

function printUpReport(applied: Synced[]): string {
  if (applied.length === 0) {
    return chalk.green('already up to date')
  }
  const pluralized = applied.length === 1 ? 'migration' : 'migrations'
  return [
    chalk.green(`applied ${applied.length} ${pluralized}`),
    ...applied.map(({ version, migration }) => (
      chalk.cyan((String(version) + ':').padStart(9), chalk.white(migration))
    ))
  ].join('\n')
}
