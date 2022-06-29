import fs from 'fs'
import { Sql } from 'postgres'

export type Synced = {
  version: number
  migration: string
}

export type Unsynced = {
  version: null
  migration: string
}

export type StatusOptions = {
  sql: Sql<{}>
  files: string
  journalTable: string
  silent?: boolean
}

export type StatusResults = {
  schemaTable: string
  synced: Synced[]
  pending: Unsynced[]
  missing: Synced[]
  untracked: Unsynced[]
  isCorrupt: boolean
  isSynchronized: boolean
  isSchemaTableNew: boolean
}

export default async function bootstrap(options: StatusOptions): Promise<StatusResults> {

  const { sql, files, journalTable } = options

  const [table, schema = 'public'] = journalTable.split('.').reverse()

  const schemaTable = `${wrapIdentifier(schema)}.${wrapIdentifier(table)}`

  const [, [baseline], synced] = await sql.unsafe<[never, [Synced | undefined], Synced[]]>(`
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
  `)

  const isSchemaTableNew = baseline != null

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

  const knownSet = new Set(all.map(({ migration }) => migration))

  const missing = synced.filter(({ migration }) => !knownSet.has(migration))
  const pending = all.filter(({ migration }) => !syncedSet.has(migration))
  const untracked = all
    .slice(0, synced.length - missing.length)
    .filter(({ migration }) => !syncedSet.has(migration))

  const isCorrupt = missing.length !== 0 && untracked.length !== 0

  return {
    synced, missing, pending, untracked, schemaTable, isCorrupt, isSynchronized, isSchemaTableNew
  }
}

function wrapIdentifier(identifier: string): string {
  return '"' + identifier.replace(/^"/, '').replace(/"$/, '') + '"'
}
