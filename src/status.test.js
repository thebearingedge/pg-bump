const path = require('path')
const fs = require('fs-extra')
const { Client } = require('pg')
const { describe, beforeEach, it, expect } = require('./__test__')
const status = require('./status')

describe('status()', () => {

  let client
  const cwd = process.cwd()
  const filesDir = path.join(cwd, 'migrations')
  const files = 'migrations'
  const tableName = 'schema_journal'

  beforeEach(() => {
    fs.mkdirpSync(filesDir)
    fs.emptyDirSync(filesDir)
    client = new Client({})
    client.connect()
    return client.query(`
      select table_name
        from information_schema.tables
       where table_schema = 'public'
    `)
    .then(({ rows }) => Promise.all(rows.map(({ table_name }) =>
      client.query(`drop table ${table_name} cascade`)
    )))
  })

  it('reports a list of pending migrations', () => {
    const fileName = `${Date.now()}_books.sql`
    const filePath = path.join(filesDir, fileName)
    fs.writeFileSync(filePath, `
      create table books (
        title text not null
      );
      ---
      drop table books;
    `)
    return status({ files, tableName })
      .then(report => expect(report).to.deep.equal([fileName]))
  })

})
