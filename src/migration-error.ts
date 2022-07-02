import chalk from 'chalk'
import { PostgresError } from 'postgres'

export function printMigrationErrorReport(
  err: PostgresError,
  file: string,
  script: string
): string {
  const { length: line } = script.slice(0, Number(err.position)).split('\n')
  return [
    chalk.red('ABORTED:', chalk.white(err.message, '\n')),
    chalk.bold(`${file}:${line}`, '\n'),
    chalk.yellow(script, '\n')
  ].join('\n')
}
