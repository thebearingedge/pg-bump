const path = require('path')
const fs = require('fs-extra')
const { Client } = require('pg')
const { describe, beforeEach, afterEach, it, expect } = require('./__test__')
const down = require('./down')

describe('down()', () => {

  let client
  const cwd = process.cwd()
  const files = 'migrations'
  const filesDir = path.join(cwd, files)
  const journalTable = 'schema_journal'
  const now = Date.now()
  const authorsFile = `${now}_authors.sql`
  const booksFile = `${now + 1}_books.sql`
  const authorsPath = path.join(filesDir, authorsFile)
  const booksPath = path.join(filesDir, booksFile)
  const createAuthors = `
    create table authors (
      author_id   serial,
      author_name text not null,
      primary key (author_id)
    );
  `
  const createBooks = `
    create table books (
      book_id    serial,
      book_title text not null,
      primary key (book_id)
    );
  `

  beforeEach(() => {
    fs.mkdirpSync(filesDir)
    fs.emptyDirSync(filesDir)
    fs.writeFileSync(authorsPath, `
      ${createAuthors}
      ---
      drop table authors;
    `)
    fs.writeFileSync(booksPath, `
      ${createBooks}
      ---
      drop table books;
    `)
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
    .then(() => client.query('begin'))
    .then(() => client.query(`
      create table ${journalTable} (
        applied_at timestamptz(6) not null default now(),
        file_name  text unique not null
      )
    `))
    .then(() => client.query(createAuthors))
    .then(() => client.query(createBooks))
    .then(() => client.query(`
      insert into schema_journal (file_name)
      values ('${authorsFile}'), ('${booksFile}');
    `))
    .then(() => client.query('commit'))
  })

  afterEach(() => client.end())

  it('reverts all migrations', () => {
    return down({ files, journalTable })
      .then(() => client.query(`
        select table_name
          from information_schema.tables
         where table_schema = 'public'
      `))
      .then(({ rows }) => expect(rows).to.have.a.lengthOf(1))
  })

  it('reverts all migrations once', () => {
    return down({ files, journalTable })
      .then(() => down({ files, journalTable }))
  })

  it('removes migrations from the journal', () => {
    return down({ files, journalTable })
      .then(() => client.query('select * from schema_journal'))
      .then(({ rows }) => expect(rows).to.have.a.lengthOf(0))
  })

  it('only reverts applied migrations', () => {
    fs.writeFileSync(path.join(filesDir, `${Date.now()}_book_authors.sql`), `
      create table book_authors (
        author_id integer not null,
        book_id   integer not null,
        foreign key (author_id)
                references authors (author_id),
        foreign key (book_id)
                references books (book_id),
        unique (author_id, book_id)
      );
      ---
      drop table book_authors;
    `)
    return down({ files, journalTable })
  })

  it('aborts bad batches', () => {
    fs.writeFileSync(booksPath, `
      ${createBooks}
      ---
      drop table books;
      FAAAAKKK
    `)
    return down({ files, journalTable })
      .catch(err => err)
      .then(err =>
        expect(err)
          .to.be.an('error')
          .with.property('message')
          .that.includes('FAAAAKKK')
      )
      .then(() => client.query(`
        select table_name
          from information_schema.tables
         where table_schema = 'public'
      `))
      .then(({ rows }) => expect(rows).to.have.a.lengthOf(3))
  })

  it('only reverts applied migrations to specified file', () => {
    const to = authorsFile
    return down({ files, journalTable, to })
      .then(() => client.query(`
        select table_name
          from information_schema.tables
         where table_schema = 'public'
      `))
      .then(({ rows }) => expect(rows).to.have.a.lengthOf(2))
  })

})
