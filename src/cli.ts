import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import postgres from 'postgres'
import { program } from 'commander'
import status from './status'
import createMigration from './create-migration'
import createLogger from './create-logger'

type PgBumpOptions = {
  config: string
  silent: boolean
  files: string
  journalTable: string
  envVar: string
}

const packageJSON = fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
const { name, version, description } = JSON.parse(packageJSON)

program
  .name(name)
  .version(`v${String(version)}`, '-v, --version', 'output the version number')
  .description(description)
  .option('-c, --config <path>', 'relative path to config file', './.pgbumprc')
  .option('-s, --silent', 'suppress log output', false)
  .option('-f, --files <path>', 'relative path to migrations directory', './migrations')
  .option('-j, --journalTable <table>', 'table used to record migration history', 'schema_journal')
  .option('-e, --env-var <variable>', 'environment variable holding the database url', 'DATABASE_URL')

program
  .command('create')
  .alias('make')
  .description('Create a new migration file.')
  .argument('<migration>', 'name of new migration to create')
  .action((script: string) => {
    const options = loadConfig(program.opts<PgBumpOptions>())
    createMigration({ ...options, script })
  })

program
  .command('status')
  .description('show pending migrations')
  .action(async () => {
    const { envVar, ...options } = loadConfig(program.opts<PgBumpOptions>())
    const sql = postgres(process.env[envVar] ?? '')
    const { pending, missing, untracked } = await status({ ...options, sql })
    const log = createLogger(options)
    if (missing.length > 0 || untracked.length > 0) {
      const corrupted = missing
        .map(migration => ({ status: 'missing', migration }))
        .concat(untracked.map(migration => ({ status: 'untracked', migration })))
        .map(({ status, migration }) => `${chalk.yellow(status)}: ${migration}`)
        .join('\n')
      log.prefix().error(chalk.bold('MIGRATIONS CORRUPTED\n\n') + corrupted)
      process.exit(1)
    } else {
      log.prefix().info(chalk.green(`found ${pending.length} pending migrations`))
      pending.forEach(migration => log.info(chalk.cyan('pending:'), chalk.white(migration)))
      process.exit(0)
    }
  })

program.parse()

function loadConfig({ config: configPath, ...defaults }: PgBumpOptions): PgBumpOptions {
  const options = fs.statSync(configPath, { throwIfNoEntry: false }) != null
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {}
  return { ...defaults, ...options }
}
