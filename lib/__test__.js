const { Client } = require('pg')
const { expect } = require('chai')

module.exports = { expect }

beforeEach(async () => {
  const client = new Client(process.env.DATABASE_URL)
  await client.connect()
  const { rows: [{ tables }] } = await client.query(`
      select array_agg(table_name::text) as tables
        from information_schema.tables
       where table_schema = 'public'
    `)
  if (tables) {
    await client.query(`drop table ${tables} cascade`)
  }
  await client.end()
})
