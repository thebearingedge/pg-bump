import chalk from 'chalk'
import { PostgresError } from 'postgres'

export function printMigrationErrorReport(
  err: PostgresError,
  file: string,
  script: string
): string {
  return [
    chalk.red('ABORTED:', chalk.white(err.message, '\n')),
    chalk.bold(`${file}:${err.line}`, '\n'),
    chalk.yellow(script, '\n')
  ].join('\n')
}
