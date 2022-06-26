import fs from 'fs'
import path from 'path'
import { program } from 'commander'
import createMigration from './create-migration'

type PgBumpOptions = {
  config: string
  silent: boolean
  files: string
  journalTable: string
  envVar: string
}

const packageJSON = fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')
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
    const { config: configPath, ...opts } = program.opts<PgBumpOptions>()
    const config: Partial<PgBumpOptions> =
      fs.statSync(path.resolve(process.cwd(), configPath), { throwIfNoEntry: false }) != null
        ? JSON.parse(fs.readFileSync(path.resolve(process.cwd(), configPath), 'utf8'))
        : {}
    createMigration({ ...config, ...opts, script })
  })

program.parse()
