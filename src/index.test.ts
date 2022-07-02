import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import postgres, { Sql } from 'postgres'

export const files = './sandbox/migrations'
export const envVar = 'TEST_DATABASE_URL'
export const journal = 'schema_journal'

let sql: Sql<{}>

beforeEach('reset sandbox/migrations dir and database', async () => {
  sql = postgres(process.env[envVar] as string)
  await sql.unsafe(`
    set client_min_messages to warning;
    drop schema public cascade;
    create schema public;
  `)
  fs.mkdirSync(files, { recursive: true })
  const entries = fs.readdirSync(files, { withFileTypes: true })
  entries.forEach(entry => {
    if (entry.isDirectory()) fs.rmSync(path.join(files, entry.name), { recursive: true })
  })
})

afterEach('close database connection', async () => {
  await sql.end()
})

export const withSql = (fn: (sql: Sql<{}>) => any) => () => {
  const sql = postgres(process.env[envVar] as string)
  fn(sql)
}
