import fs from 'fs'
import chalk from 'chalk'
import { Sql } from 'postgres'

export type Synced = {
  version: number
  migration: string
}

export type NotSynced = {
  version: null
  migration: string
}

export type StatusOptions = {
  sql: Sql<{}>
  files: string
  journal: string
  printStatus?: boolean
}

export type StatusResults = {
  isError: boolean
  summary: Array<{ isError: boolean, message: string }>
  schemaTable: string
  synced: Synced[]
  missing: Synced[]
  passed: NotSynced[]
  pending: NotSynced[]
}

export function createSchemaTable(schemaTable: string): string {
  return `
    set client_min_messages to warning;

    create table if not exists ${schemaTable} (
      version    integer        not null,
      migration  text           not null,
      applied_at timestamptz(6) not null default now(),
      unique (version),
      unique (migration)
    );

    insert into ${schemaTable} (version, migration)
    values (0, 'baseline')
    on conflict (version)
    do nothing
    returning version,
              migration;

    select version,
           migration
      from ${schemaTable}
     where version > 0
     order by version;
  `
}

export default async function status(options: StatusOptions): Promise<StatusResults> {

  const { sql, files, journal, printStatus = false } = options

  const schemaTable = (sql(journal) as unknown as { value: string }).value.replace(/"""/g, '"')

  const [, [baseline], synced] = await sql
    .unsafe<[never, [Synced | undefined], Synced[]]>(createSchemaTable(schemaTable))

  const isSchemaTableNew = baseline != null

  const summary = isSchemaTableNew
    ? [{ isError: false, message: chalk.green(`created table ${schemaTable}`) }]
    : []

  fs.mkdirSync(files, { recursive: true })

  const all = fs.readdirSync(files, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(({ name }) => ({ version: null, migration: name }))
    .sort((a, b) => a.migration < b.migration ? -1 : 1)

  const syncedSet = new Set(synced.map(({ migration }) => migration))

  const isSynchronized = all.length === synced.length &&
                         all.every(({ migration }) => syncedSet.has(migration))

  if (isSynchronized) {
    return {
      isError: false,
      schemaTable,
      synced,
      missing: [],
      passed: [],
      pending: [],
      summary: printStatus
        ? summary.concat({ isError: false, message: printStatusReport(synced) })
        : summary
    }
  }

  const allSet = new Set(all.map(({ migration }) => migration))

  const missing = synced.filter(({ migration }) => !allSet.has(migration))
  const pending = all.filter(({ migration }) => !syncedSet.has(migration))
  const passed = all
    .slice(0, synced.length - missing.length)
    .filter(({ migration }) => !syncedSet.has(migration))

  const isError = missing.length !== 0 || passed.length !== 0

  return {
    isError,
    schemaTable,
    synced,
    missing,
    passed,
    pending,
    summary: isError
      ? summary.concat({ isError: true, message: printCorruptionReport(passed, missing) })
      : printStatus
        ? summary.concat({ isError: false, message: printStatusReport(synced, pending) })
        : summary
  }
}

function printStatusReport(synced: Synced[], pending: NotSynced[] = []): string {
  const pluralized = pending.length === 1 ? 'migration' : 'migrations'
  return [
    chalk.green(`found ${pending.length} pending ${pluralized}`),
    ...synced.map(({ version, migration }) => (
      chalk.cyan((String(version) + ':').padStart(9), chalk.white(migration))
    )),
    ...pending.map(({ migration }) => chalk.cyan('(pending)', chalk.white(migration)))
  ].join('\n')
}

function printCorruptionReport(passed: NotSynced[], missing: Synced[]): string {
  return chalk.bold('MIGRATIONS CORRUPT\n') + missing
    .map(({ migration }) => ({ status: 'missing:', migration }))
    .concat(passed.map(({ migration }) => ({ status: 'passed:', migration })))
    .sort((a, b) => a.migration < b.migration ? -1 : 1)
    .map(({ status, migration }) => `${chalk.yellow(status.padStart(9))} ${migration}`)
    .join('\n')
}
