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

}
