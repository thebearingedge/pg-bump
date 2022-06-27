import fs from 'fs'
import chalk from 'chalk'
import { Sql } from 'postgres'
import createLogger from './create-logger'

export type BootstrapOptions = {
  sql: Sql<{}>
  files: string
  journalTable: string
  silent?: boolean
}

export type BootstrapResults = {
  applied: string[]
  pending: string[]
  missing: string[]
  untracked: string[]
}

type Created = { version: number }
type Applied = { migration: string }

export async function bootstrap(options: BootstrapOptions): Promise<BootstrapResults> {

  const { sql, files, journalTable, silent = true } = options

  const log = createLogger({ silent })

  const [table, schema = 'public'] = journalTable.split('.').reverse()

  const schemaTable = `${wrapIdentifier(schema)}.${wrapIdentifier(table)}`

  const [, created, appliedMigrations] = await sql.unsafe<[unknown, Created[], Applied[]]>(`
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
    returning *;

    select migration
      from ${schemaTable}
     where version > 0
     order by version;
  `)

  if (created.length !== 0) {
    log.info(chalk.red('[pg-bump]', chalk.green(`created ${schemaTable}`)))
  }

  fs.mkdirSync(files, { recursive: true })

  const known = fs.readdirSync(files, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(({ name }) => name)
    .sort()

  const applied = appliedMigrations.map(({ migration }) => migration)
  const appliedSet = new Set(applied)

  const isSynchronized = known.length === applied.length &&
                         known.every(migration => appliedSet.has(migration))

  if (isSynchronized) return { applied, pending: [], missing: [], untracked: [] }

  const knownSet = new Set(known)

  const pending = known.filter(migration => !appliedSet.has(migration))
  const missing = applied.filter(migration => !knownSet.has(migration))
  const untracked = known
    .slice(0, applied.length - missing.length)
    .filter(migration => !appliedSet.has(migration))

  return { applied, missing, pending, untracked }
}

function wrapIdentifier(identifier: string): string {
  return '"' + identifier.replace(/^"/, '').replace(/"$/, '') + '"'
}
