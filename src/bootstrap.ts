import fs from 'fs'
import { Sql } from 'postgres'

export type BootstrapOptions = {
  sql: Sql<{}>
  files: string
  journalTable: string
  silent?: boolean
}

export type BootstrapResults = {
  schemaTable: string
  synced: string[]
  pending: string[]
  missing: string[]
  untracked: string[]
  isCorrupt: boolean
  isSynchronized: boolean
  isSchemaTableNew: boolean
}

type Created = { version: number }
type Synced = { migration: string }

export default async function bootstrap(options: BootstrapOptions): Promise<BootstrapResults> {

  const { sql, files, journalTable } = options

  const [table, schema = 'public'] = journalTable.split('.').reverse()

  const schemaTable = `${wrapIdentifier(schema)}.${wrapIdentifier(table)}`

  const [, created, applied] = await sql.unsafe<[unknown, Created[], Synced[]]>(`
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

  const isSchemaTableNew = created.length !== 0

  fs.mkdirSync(files, { recursive: true })

  const known = fs.readdirSync(files, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(({ name }) => name)
    .sort()

  const synced = applied.map(({ migration }) => migration)
  const syncedSet = new Set(synced)

  const isSynchronized = known.length === synced.length &&
                         known.every(migration => syncedSet.has(migration))

  if (isSynchronized) {
    return {
      synced,
      pending: [],
      missing: [],
      untracked: [],
      schemaTable,
      isCorrupt: false,
      isSynchronized,
      isSchemaTableNew
    }
  }

  const knownSet = new Set(known)

  const pending = known.filter(migration => !syncedSet.has(migration))
  const missing = synced.filter(migration => !knownSet.has(migration))
  const untracked = known
    .slice(0, synced.length - missing.length)
    .filter(migration => !syncedSet.has(migration))

  const isCorrupt = missing.length !== 0 && untracked.length !== 0

  return {
    synced, missing, pending, untracked, schemaTable, isCorrupt, isSynchronized, isSchemaTableNew
  }
}

function wrapIdentifier(identifier: string): string {
  return '"' + identifier.replace(/^"/, '').replace(/"$/, '') + '"'
}
