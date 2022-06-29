import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import postgres from 'postgres'
import { program, Option } from 'commander'
import up from './up'
import down from './down'
import create from './create'
import withSql from './with-sql'
import createLogger from './create-logger'
import MigrationError from './migration-error'
import bootstrap, { Synced, Unsynced } from './status'

type PgBumpOptions = {
  config: string
  silent: boolean
  files: string
  envVar: string
  transaction: boolean
  journalTable: string
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
    const log = createLogger(options)
    log.prefix().info(chalk.green('creating migration files...'))
    const migration = create({ ...options, script })
    log.info(chalk.cyan('created:'), chalk.white(path.join(migration, '{up,down}.sql')))
  })

program
  .command('up')
  .description('apply pending migrations')
  .option('-t, --transaction', 'wrap migrations in a transaction', true)
  .action(async options => {
    const { envVar, transaction, ...opts } = loadConfig(program.opts<PgBumpOptions>())
    const log = createLogger(opts)
    const sql = postgres(process.env[envVar] as string)
    const { isCorrupt, ...results } = await withSql({ sql, transaction }, async sql => {
      try {
        return await up({ sql, ...opts, ...options })
      } catch (err) {
        if (!(err instanceof MigrationError)) throw err
        log.prefix().error(printMigrationErrorReport(err))
        process.exit(1)
      }
    })
    if (isCorrupt) {
      const { missing, untracked } = results
      log.prefix().error(printCorruptionReport(missing, untracked))
      process.exit(1)
    }
    const { isSchemaTableNew, schemaTable } = results
    if (isSchemaTableNew) log.prefix().info(chalk.green(`created ${schemaTable}`))
    const { applied } = results
    log.prefix().info(printUpReport(applied))
    void sql.end()
  })

program
  .command('down')
  .description('revert synced migrations')
  .option('-t, --transaction', 'wrap migrations in a transaction', true)
  .addOption(new Option('--to <version>', 'revert to schema <version>').argParser(parseInt))
  .action(async options => {
    const { envVar, transaction, ...opts } = loadConfig(program.opts<PgBumpOptions>())
    const log = createLogger(opts)
    const sql = postgres(process.env[envVar] as string)
    const { isCorrupt, ...results } = await withSql({ sql, transaction }, async sql => {
      try {
        return await down({ sql, ...opts, ...options })
      } catch (err) {
        if (!(err instanceof MigrationError)) throw err
        log.prefix().error(printMigrationErrorReport(err))
        process.exit(1)
      }
    })
    if (isCorrupt) {
      const { missing, untracked } = results
      log.prefix().error(printCorruptionReport(missing, untracked))
      process.exit(1)
    }
    const { isSchemaTableNew, schemaTable } = results
    if (isSchemaTableNew) log.prefix().info(chalk.green(`created ${schemaTable}`))
    const { reverted } = results
    log.prefix().info(printDownReport(reverted))
    void sql.end()
  })

program
  .command('status')
  .description('show pending migrations')
  .action(async () => {
    const { envVar, ...options } = loadConfig(program.opts<PgBumpOptions>())
    const log = createLogger(options)
    const sql = postgres(process.env[envVar] as string)
    const { isCorrupt, ...results } = await bootstrap({ ...options, sql })
    if (isCorrupt) {
      const { missing, untracked } = results
      log.prefix().error(printCorruptionReport(missing, untracked))
      process.exit(1)
    }
    const { isSchemaTableNew, schemaTable } = results
    if (isSchemaTableNew) {
      log.prefix().info(chalk.green(`created ${schemaTable}`))
    }
    const { pending, synced } = results
    log.prefix().info(printStatusReport(pending, synced))
    void sql.end()
  })

program.parse()

function loadConfig({ config: configPath, ...defaults }: PgBumpOptions): PgBumpOptions {
  const loaded = fs.statSync(configPath, { throwIfNoEntry: false }) != null
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {}
  return { ...defaults, ...loaded }
}

function printCorruptionReport(missing: Synced[], untracked: Unsynced[]): string {
  const corrupted = missing
    .map(({ migration }) => ({ status: 'missing', migration }))
    .concat(untracked.map(({ migration }) => ({ status: 'untracked', migration })))
    .map(({ status, migration }) => `${chalk.yellow(status)}: ${migration}`)
    .join('\n')
  return chalk.bold('\n\nMIGRATIONS CORRUPTED\n\n') + corrupted
}

function printMigrationErrorReport(err: MigrationError): string {
  return [
    chalk.red('ABORTED:', chalk.white(err.message, '\n')),
    chalk.bold(err.file, 'line', err.line, '\n'),
    chalk.yellow(err.script, '\n')
  ].join('\n')
}

function printStatusReport(pending: Unsynced[], synced: Synced[]): string {
  const pluralized = pending.length === 1 ? 'migration' : 'migrations'
  return [
    chalk.green(`found ${pending.length} pending ${pluralized}`),
    ...synced.map(({ version, migration }) => (
      chalk.cyan((String(version) + ':').padStart(9), chalk.white(migration))
    )),
    ...pending.map(({ migration }) => chalk.cyan('(pending)', chalk.white(migration)))
  ].join('\n')
}

function printUpReport(applied: Synced[]): string {
  if (applied.length === 0) {
    return chalk.green('already up to date')
  } else {
    const pluralized = applied.length === 1 ? 'migration' : 'migrations'
    return [
      chalk.green(`applied ${applied.length} ${pluralized}`),
      ...applied.map(({ version, migration }) => (
        chalk.cyan((String(version) + ':').padStart(9), chalk.white(migration))
      ))
    ].join('\n')
  }
}

function printDownReport(reverted: Synced[]): string {
  if (reverted.length === 0) {
    return chalk.green('already at base migration')
  } else {
    const pluralized = reverted.length === 1 ? 'migration' : 'migrations'
    return [
      chalk.green(`reverted ${reverted.length} ${pluralized}`),
      ...reverted.map(({ version, migration }) => (
        chalk.cyan((String(version) + ':').padStart(9), chalk.white(migration))
      ))
    ].join('\n')
  }
}
