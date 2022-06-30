import fs from 'fs'
import url from 'url'
import path from 'path'
import chalk from 'chalk'
import postgres, { Sql } from 'postgres'
import { program, Option } from 'commander'
import up from './up.js'
import down from './down.js'
import create from './create.js'
import status from './status.js'
import withSql from './with-sql.js'
import log from './logger.js'
import { PgBumpConfigFile } from './index'

type CliArgs = PgBumpConfigFile & {
  configPath?: string
}

type LoadedArgs = Omit<{ [K in keyof CliArgs]-?: CliArgs[K] }, 'configPath' | 'envVar' | 'client'> & {
  sql: Sql<{}>
}

const packageJSON = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../package.json')

const { name, version, description } = JSON.parse(fs.readFileSync(packageJSON, 'utf8'))

const defaults = {
  envVar: 'DATABASE_URL',
  files: './migrations',
  journal: 'schema_journal'
}

program
  .name(name)
  .version(`v${String(version)}`, '-v, --version', 'output the version number')
  .description(description)
  .option('-c, --config-path <path>', 'relative path to config file')
  .option('-f, --files <path>', 'relative path to migrations directory')
  .option('-e, --env-var <variable>', 'database url environment variable')
  .option('-j, --journal <table>', 'table used to record migration history')

program
  .command('make')
  .alias('create')
  .description('create a new migration file')
  .argument('<migration>', 'name of new migration')
  .action(async (name: string) => {
    const options = await loadConfig(program.opts<CliArgs>())
    log.info(chalk.green('creating migration files...'))
    const migration = create({ ...options, name })
    log.info(chalk.cyan(' created:'), chalk.white(path.join(migration, '{up,down}.sql')))
  })

program
  .command('status')
  .description('show pending migrations')
  .action(async () => {
    const flags = { lock: false, transaction: false }
    const { sql, files, journal } = await loadConfig(program.opts<CliArgs>())
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
    const { sql, files, journal } = await loadConfig(program.opts<CliArgs>())
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
    const { sql, files, journal } = await loadConfig(program.opts<CliArgs>())
    const { isError, summary } = await withSql({ sql, ...flags }, async sql => {
      return await down({ sql, files, journal, ...flags })
    })
    summary.forEach(({ isError, message }) => isError ? log.error(message) : log.info(message))
    process.exit(isError ? 1 : 0)
  })

program.parse()

async function loadConfig(
  { configPath = './.pgbumprc', ...cliArgs }: CliArgs
): Promise<LoadedArgs> {

  if (fs.statSync(configPath, { throwIfNoEntry: false }) == null) {
    const { envVar, ...args } = { ...defaults, ...cliArgs }
    return { ...args, sql: postgres(process.env[envVar] as string) }
  }

  const config: PgBumpConfigFile = path.extname(configPath) !== '.js'
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : (await import(path.resolve(process.cwd(), configPath))).default

  const { envVar, client, ...args } = { ...defaults, ...config, ...cliArgs }

  if (typeof client === 'function') {
    return { ...args, sql: await client() }
  }

  if (typeof client === 'undefined') {
    return { ...args, sql: postgres(process.env[envVar] as string) }
  }

  const sql = typeof process.env[envVar] === 'string'
    ? postgres(process.env[envVar] as string, client)
    : postgres(client)

  return { ...args, sql }
}
