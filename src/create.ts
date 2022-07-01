import fs from 'fs'
import path from 'path'
import chalk from 'chalk'

type CreateMigrationOptions = {
  name: string
  files: string
}

type CreateMigrationResults = {
  isError: false
  migration: string
  summary: Array<{ isError: boolean, message: string }>
}

export default function createMigration(options: CreateMigrationOptions): CreateMigrationResults {

  const { name, files } = options

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
