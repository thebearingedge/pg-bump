const path = require('path')
const fs = require('fs-extra')
const { Client } = require('pg')
const { describe, beforeEach, afterEach, it, expect } = require('./__test__')
const status = require('./status')

describe('status()', () => {

  let client
  const cwd = process.cwd()
  const filesDir = path.join(cwd, 'migrations')
  const files = 'migrations'
  const journalTable = 'schema_journal'

  beforeEach(() => {
    fs.mkdirpSync(filesDir)
    fs.emptyDirSync(filesDir)
    client = new Client(process.env.DATABASE_URL)
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

  afterEach(() => client.end())

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
    return status({ files, journalTable })
      .then(report => expect(report).to.deep.equal([fileName]))
  })

  it('reports extra files in the migrations directory', () => {
    const now = Date.now()
    const createBooks = `${now}_books.sql`
    fs.writeFileSync(path.join(filesDir, createBooks), `
      create table books (
        title text not null
      );
      ---
      drop table books;
    `)
    return status({ files, journalTable })
      .then(() => client.query(`
        insert into schema_journal (version, file_name)
        values (1, '${createBooks}')
      `))
      .then(() => fs.writeFileSync(path.join(filesDir, `${now - 1}_authors.sql`), `
        create table authors (
          name text not null
        );
        ---
        drop table authors;
      `))
      .then(() => status({ files, journalTable }))
      .catch(err => err)
      .then(err =>
        expect(err)
          .to.be.an('error')
          .with.property('message')
          .that.includes('untracked')
      )
  })

  it('reports missing files in the migrations directory', () => {
    const now = Date.now()
    const createBooks = `${now}_books.sql`
    fs.writeFileSync(path.join(filesDir, createBooks), `
      create table books (
        title text not null
      );
      ---
      drop table books;
    `)
    return status({ files, journalTable })
      .then(() => client.query(`
        insert into schema_journal (version, file_name)
        values (1, '${createBooks}'), (2, '${Date.now()}_authors.sql')
      `))
      .then(() => status({ files, journalTable }))
      .catch(err => err)
      .then(err =>
        expect(err)
          .to.be.an('error')
          .with.property('message')
          .that.includes('missing')
      )
  })

})
