import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import postgres from 'postgres'
import { program, Option } from 'commander'
import status from './status'
import up from './up'
import down from './down'
import create from './create'
import withSql from './with-sql'
import log from './logger'

type PgBumpOptions = {
  config: string
  files: string
  envVar: string
  journal: string
}

const {
  name,
  version,
  description
} = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'))

program
  .name(name)
  .version(`v${String(version)}`, '-v, --version', 'output the version number')
  .description(description)
  .option('-c, --config <path>', 'relative path to config file', './.pgbumprc')
  .option('-f, --files <path>', 'relative path to migrations directory', './migrations')
  .option('-e, --env-var <variable>', 'database url environment variable', 'DATABASE_URL')
  .option('-j, --journal <table>', 'table used to record migration history', 'schema_journal')

program
  .command('make')
  .alias('create')
  .description('create a new migration file')
  .argument('<migration>', 'name of new migration')
  .action((script: string) => {
    const options = loadConfig(program.opts<PgBumpOptions>())
    log.info(chalk.green('creating migration files...'))
    const migration = create({ ...options, script })
    log.info(chalk.cyan(' created:'), chalk.white(path.join(migration, '{up,down}.sql')))
  })

program
  .command('status')
  .description('show pending migrations')
  .action(async () => {
    const flags = { lock: false, transaction: false }
    const { envVar, files, journal } = loadConfig(program.opts<PgBumpOptions>())
    const sql = postgres(process.env[envVar] as string)
    const { isError, summary } = await withSql({ sql, ...flags }, async sql => {
      return await status({ sql, files, journal, printStatus: true })
    })
    summary.forEach(({ isError, message }) => isError ? log.error(message) : log.info(message))
    process.exit(isError ? 1 : 0)
  })

program
  .command('up')
  .description('apply pending migrations')
  .option('-l, --lock', 'acquire a advisory lock during migration', true)
  .option('--no-lock', 'disable advisory lock during migration')
  .option('-t, --transaction', 'wrap migrations in a transaction', true)
  .option('--no-transaction', 'do not run migrations in a transaction')
  .action(async (flags: { lock: boolean, transaction: boolean }) => {
    const { envVar, files, journal } = loadConfig(program.opts<PgBumpOptions>())
    const sql = postgres(process.env[envVar] as string)
    const { isError, summary } = await withSql({ sql, ...flags }, async sql => {
      return await up({ sql, files, journal, ...flags })
    })
    summary.forEach(({ isError, message }) => isError ? log.error(message) : log.info(message))
    process.exit(isError ? 1 : 0)
  })

program
  .command('down')
  .description('revert synced migrations')
  .option('--no-lock', 'disable advisory lock during migration')
  .option('-l, --lock', 'acquire a advisory lock during migration', true)
  .option('--no-transaction', 'do not run migrations in a transaction')
  .option('-t, --transaction', 'wrap migrations in a transaction', true)
  .addOption(new Option('--to <version>', 'revert to schema <version>').argParser(parseInt))
  .action(async (flags: { to: number, lock: boolean, transaction: boolean }) => {
    const { envVar, files, journal } = loadConfig(program.opts<PgBumpOptions>())
    const sql = postgres(process.env[envVar] as string)
    const { isError, summary } = await withSql({ sql, ...flags }, async sql => {
      return await down({ sql, files, journal, ...flags })
    })
    summary.forEach(({ isError, message }) => isError ? log.error(message) : log.info(message))
    process.exit(isError ? 1 : 0)
  })

program.parse()

function loadConfig({ config: configPath, ...defaults }: PgBumpOptions): PgBumpOptions {
  const loaded = fs.statSync(configPath, { throwIfNoEntry: false }) != null
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {}
  return { ...defaults, ...loaded }
}
