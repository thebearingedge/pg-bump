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
import status, { Synced, Unsynced } from './status'

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
  .option('-s, --silent', 'suppress log output', false)
  .option('-c, --config <path>', 'relative path to config file', './.pgbumprc')
  .option('-f, --files <path>', 'relative path to migrations directory', './migrations')
  .option('-e, --env-var <variable>', 'database url environment variable', 'DATABASE_URL')
  .option('-j, --journalTable <table>', 'table used to record migration history', 'schema_journal')

program
  .command('make')
  .alias('create')
  .description('create a new migration file')
  .argument('<migration>', 'name of new migration')
  .action((script: string) => {
    const options = loadConfig(program.opts<PgBumpOptions>())
    const log = createLogger(options)
    log.info(chalk.green('creating migration files...'))
    const migration = create({ ...options, script })
    log.info(chalk.cyan(' created:'), chalk.white(path.join(migration, '{up,down}.sql')))
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
        log.error(printMigrationErrorReport(err))
        process.exit(1)
      }
    })
    if (isCorrupt) {
      const { missing, passed } = results
      log.error(printCorruptionReport(missing, passed))
      process.exit(1)
    }
    const { isSchemaTableNew, schemaTable } = results
    if (isSchemaTableNew) {
      log.info(chalk.green(`created ${schemaTable}`))
    }
    const { applied } = results
    log.info(printUpReport(applied))
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
        log.error(printMigrationErrorReport(err))
        process.exit(1)
      }
    })
    if (isCorrupt) {
      const { missing, passed } = results
      log.error(printCorruptionReport(missing, passed))
      process.exit(1)
    }
    const { isSchemaTableNew, schemaTable } = results
    if (isSchemaTableNew) {
      log.info(chalk.green(`created ${schemaTable}`))
    }
    const { reverted } = results
    log.info(printDownReport(reverted))
  })

program
  .command('status')
  .description('show pending migrations')
  .action(async () => {
    const { envVar, ...options } = loadConfig(program.opts<PgBumpOptions>())
    const log = createLogger(options)
    const sql = postgres(process.env[envVar] as string)
    const { isCorrupt, ...results } = await withSql({ sql, ...options }, async sql => {
      return await status({ ...options, sql })
    })
    if (isCorrupt) {
      const { missing, passed } = results
      log.error(printCorruptionReport(missing, passed))
      process.exit(1)
    }
    const { isSchemaTableNew, schemaTable } = results
    if (isSchemaTableNew) {
      log.info(chalk.green(`created table ${schemaTable}`))
    }
    const { pending, synced } = results
    log.info(printStatusReport(pending, synced))
  })

program.parse()

function loadConfig({ config: configPath, ...defaults }: PgBumpOptions): PgBumpOptions {
  const loaded = fs.statSync(configPath, { throwIfNoEntry: false }) != null
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {}
  return { ...defaults, ...loaded }
}

function printCorruptionReport(missing: Synced[], passed: Unsynced[]): string {
  return chalk.bold('MIGRATIONS CORRUPT\n') + missing
    .map(({ migration }) => ({ status: 'missing:', migration }))
    .concat(passed.map(({ migration }) => ({ status: 'passed:', migration })))
    .sort((a, b) => a.migration < b.migration ? -1 : 1)
    .map(({ status, migration }) => `${chalk.yellow(status.padStart(9))} ${migration}`)
    .join('\n')
}

function printMigrationErrorReport(err: MigrationError): string {
  return [
    chalk.red('ABORTED:', chalk.white(err.message, '\n')),
    chalk.bold(`${err.file}:${err.line}`, '\n'),
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
  }
  const pluralized = applied.length === 1 ? 'migration' : 'migrations'
  return [
    chalk.green(`applied ${applied.length} ${pluralized}`),
    ...applied.map(({ version, migration }) => (
      chalk.cyan((String(version) + ':').padStart(9), chalk.white(migration))
    ))
  ].join('\n')
}

function printDownReport(reverted: Synced[]): string {
  if (reverted.length === 0) {
    return chalk.green('already at base migration')
  }
  const pluralized = reverted.length === 1 ? 'migration' : 'migrations'
  return [
    chalk.green(`reverted ${reverted.length} ${pluralized}`),
    ...reverted.map(({ version, migration }) => (
      chalk.cyan((String(version) + ':').padStart(9), chalk.white(migration))
    ))
  ].join('\n')
}
