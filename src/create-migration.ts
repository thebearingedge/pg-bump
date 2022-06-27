import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import createLogger from './create-logger'

type CreateMigrationOptions = {
  files: string
  script: string
  silent?: boolean
}

export default function createMigration(options: CreateMigrationOptions): string {

  /* c8 ignore next */
  const { files, script, silent = true } = options

  const log = createLogger({ silent })

  log.prefix().info(chalk.green('creating migration files...'))

  const timestamp = Date.now().toString()
  const directoryName = `${timestamp}_${script}`
  const directoryPath = path.resolve(process.cwd(), path.join(files, directoryName))

  fs.mkdirSync(directoryPath, { recursive: true })
  fs.closeSync(fs.openSync(path.join(directoryPath, 'up.sql'), 'w'))
  fs.closeSync(fs.openSync(path.join(directoryPath, 'down.sql'), 'w'))

  log.info(chalk.cyan('created:'), chalk.white(path.join(directoryName, 'up.sql')))
  log.info(chalk.cyan('created:'), chalk.white(path.join(directoryName, 'down.sql')))

  return directoryName
}
