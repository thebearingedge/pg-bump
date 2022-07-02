import fs from 'fs'
import path from 'path'
import chalk from 'chalk'

type CreateOptions = {
  name: string
  files: string
}

type CreateResults = {
  isError: false
  migration: string
  summary: Array<{ isError: boolean, message: string }>
}

export default function create({ name, files }: CreateOptions): CreateResults {

  const timestamp = Date.now().toString()
  const migration = `${timestamp}_${name}`
  const migrationPath = path.resolve(process.cwd(), path.join(files, migration))

  fs.mkdirSync(migrationPath, { recursive: true })
  fs.closeSync(fs.openSync(path.join(migrationPath, 'up.sql'), 'w'))
  fs.closeSync(fs.openSync(path.join(migrationPath, 'down.sql'), 'w'))

  return {
    isError: false,
    migration,
    summary: [
      {
        isError: false,
        message: chalk.cyan(' created:', chalk.white(path.join(migration, '{up,down}.sql')))
      }
    ]
  }
}
