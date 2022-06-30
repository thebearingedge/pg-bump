import fs from 'fs'
import path from 'path'

type CreateMigrationOptions = {
  files: string
  name: string
  silent?: boolean
}

export default function createMigration(options: CreateMigrationOptions): string {

  const { files, name } = options

  const timestamp = Date.now().toString()
  const migration = `${timestamp}_${name}`
  const migrationPath = path.resolve(process.cwd(), path.join(files, migration))

  fs.mkdirSync(migrationPath, { recursive: true })
  fs.closeSync(fs.openSync(path.join(migrationPath, 'up.sql'), 'w'))
  fs.closeSync(fs.openSync(path.join(migrationPath, 'down.sql'), 'w'))

  return migration
}
