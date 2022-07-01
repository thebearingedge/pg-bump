import type { Sql, Options, PostgresType } from 'postgres'

export type PgBumpConfigFile<
  T extends { [key: string]: unknown } = {},
  P extends { [key: string]: PostgresType } = {}
> = {
  files?: string
  envVar?: string
  journal?: string
  require?: string[]
  client?: Options<P> | (() => Sql<T> | Promise<Sql<T>>)
}

export { default as up } from './up.js'
export { default as down } from './down.js'
export { default as status } from './status.js'
export { default as create } from './create.js'
