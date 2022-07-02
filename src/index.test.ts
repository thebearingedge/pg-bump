import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { Done } from 'mocha'
import postgres, { Sql } from 'postgres'

export const files = './sandbox/migrations'
export const envVar = 'TEST_DATABASE_URL'
export const journal = 'schema_journal'

let sql: Sql<{}>

beforeEach('reset sandbox/migrations dir and database', async () => {
  fs.mkdirSync(files, { recursive: true })
  fs.readdirSync(files, { withFileTypes: true }).forEach(entry => {
    if (entry.isDirectory()) fs.rmSync(path.join(files, entry.name), { recursive: true })
  })
})

afterEach('close database connection', async () => await sql?.end())

export const withSql = (fn: (sql: Sql<{}>) => any) => (done: Done) => {
  sql = postgres(process.env[envVar] as string)
  sql
    .unsafe(`
      set client_min_messages to warning;
      drop schema public cascade;
      create schema public;
    `)
    .then(() => { fn(sql); done() })
    .catch(done)
}
