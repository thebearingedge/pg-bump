const path = require('path')
const fs = require('fs-extra')
const { Client } = require('pg')
const { expect } = require('./__test__')
const status = require('./status')

describe('status()', () => {

  let client
  const cwd = process.cwd()
  const filesDir = path.join(cwd, 'migrations')
  const files = 'migrations'
  const journalTable = 'schema_journal'

  beforeEach(async () => {
    fs.mkdirpSync(filesDir)
    fs.emptyDirSync(filesDir)
    client = new Client(process.env.DATABASE_URL)
    await client.connect()
  })

  afterEach(() => client.end())

  it('reports a list of pending migrations', async () => {
    const booksFile = `${Date.now()}_books.sql`
    const booksPath = path.join(filesDir, booksFile)
    fs.writeFileSync(booksPath, `
      create table books (
        title text not null
      );
      ---
      drop table books;
    `)
    const report = await status({ files, journalTable })
    expect(report).to.deep.equal([booksFile])
  })

  it('reports extra files in the migrations directory', async () => {
    const now = Date.now()
    const booksFile = `${now}_books.sql`
    const booksPath = path.join(filesDir, booksFile)
    fs.writeFileSync(booksPath, `
      create table books (
        title text not null
      );
      ---
      drop table books;
    `)
    await status({ files, journalTable })
    await client.query(`
      insert into schema_journal (version, file_name)
      values (1, '${booksFile}')
    `)
    const authorsFile = `${now - 1}_authors.sql`
    const authorsPath = path.join(filesDir, authorsFile)
    fs.writeFileSync(authorsPath, `
      create table authors (
        name text not null
      );
      ---
      drop table authors;
    `)
    const err = await status({ files, journalTable }).catch(err => err)
    expect(err)
      .to.be.an('error')
      .with.property('message')
      .that.includes('untracked')
      .and.includes(authorsFile)
  })

  it('reports missing files in the migrations directory', async () => {
    const now = Date.now()
    const booksFile = `${now}_books.sql`
    const booksPath = path.join(filesDir, booksFile)
    fs.writeFileSync(booksPath, `
      create table books (
        title text not null
      );
      ---
      drop table books;
    `)
    await status({ files, journalTable })
    await client.query(`
      insert into schema_journal (version, file_name)
      values (1, '${booksFile}'), (2, '${Date.now()}_authors.sql')
    `)
    const err = await status({ files, journalTable }).catch(err => err)
    expect(err)
      .to.be.an('error')
      .with.property('message')
      .that.includes('missing')
  })

})
