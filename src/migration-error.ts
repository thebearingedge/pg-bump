import { PostgresError } from 'postgres'

export default class MigrationError extends Error {

  file: string
  line: number
  script: string

  constructor(message: string, file: string, line: number, script: string) {
    super(message)
    this.file = file
    this.line = line
    this.script = script
  }

  static fromPostgres(err: PostgresError, file: string, script: string): MigrationError {
    const { message, position } = err
    const { length: line } = script.slice(0, Number(position)).split('\n')
    return new MigrationError(message, file, line, script)
  }

}
