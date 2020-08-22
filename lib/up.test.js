const path = require('path')
const fs = require('fs-extra')
const { Client } = require('pg')
const { expect } = require('./__test__')
const up = require('./up')

describe('up()', () => {

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

  it('executes a migration script', async () => {
    const booksFile = `${Date.now()}_books.sql`
    const booksPath = path.join(filesDir, booksFile)
    fs.writeFileSync(booksPath, `
      create table books (
        title text not null
      );
    `)
    await up({ files, journalTable })
    const { rowCount } = await client.query('select * from books')
    expect(rowCount).to.equal(0)
  })

  it('executes a migration script once', async () => {
    const booksFile = `${Date.now()}_books.sql`
    const booksPath = path.join(filesDir, booksFile)
    fs.writeFileSync(booksPath, `
      create table books (
        title text not null
      );
    `)
    await up({ files, journalTable })
    await up({ files, journalTable })
  })

  it('executes migration scripts in order', async () => {
    const now = Date.now()
    const authorsFile = `${now}_authors.sql`
    const authorsPath = path.join(filesDir, authorsFile)
    fs.writeFileSync(authorsPath, `
      create table authors (
        author_id   serial,
        author_name text not null,
        primary key (author_id)
      );
    `)
    const booksFile = `${now + 1}_books.sql`
    const booksPath = path.join(filesDir, booksFile)
    fs.writeFileSync(booksPath, `
      create table books (
        book_id    serial,
        book_title text not null,
        author_id  integer not null,
        foreign key (author_id)
                references authors (author_id)
      );
    `)
    const fileNames = [authorsFile, booksFile]
    await up({ files, journalTable })
    const { rows: applied } = await client.query(`
      select version, file_name
        from ${journalTable}
        order by file_name asc
    `)
    applied.forEach(({ version, file_name }, index) => {
      expect(version).to.equal(index + 1)
      expect(file_name).to.equal(fileNames[index])
    })
  })

  it('only executes the "up" portion of migration scripts', async () => {
    const now = Date.now()
    const authorsFile = `${now}_authors.sql`
    const authorsPath = path.join(filesDir, authorsFile)
    fs.writeFileSync(authorsPath, `
      create table authors (
        author_id   serial,
        author_name text not null,
        primary key (author_id)
      );
      ---
      drop table authors;
    `)
    const booksFile = `${now + 1}_books.sql`
    const booksPath = path.join(filesDir, booksFile)
    fs.writeFileSync(booksPath, `
      create table books (
        book_id    serial,
        book_title text not null,
        author_id  integer not null,
        foreign key (author_id)
                references authors (author_id)
      );
      ---
      drop table books;
    `)
    await up({ files, journalTable })
    await client.query(`
      select *
        from authors
        join books using (author_id)
    `)
  })

  it('only executes pending migration scripts', async () => {
    const now = Date.now()
    const authorsFile = `${now}_authors.sql`
    const authorsPath = path.join(filesDir, authorsFile)
    fs.writeFileSync(authorsPath, `
      create table authors (
        author_id   serial,
        author_name text not null,
        primary key (author_id)
      );
      ---
      drop table authors;
    `)
    const booksFile = `${now + 1}_books.sql`
    const booksPath = path.join(filesDir, booksFile)
    fs.writeFileSync(booksPath, `
      create table books (
        book_id    serial,
        book_title text not null,
        primary key (book_id)
      );
      ---
      drop table books;
    `)
    await up({ files, journalTable })
    const bookAuthorsFile = `${now + 2}_book_authors.sql`
    const bookAuthorsPath = path.join(filesDir, bookAuthorsFile)
    fs.writeFileSync(bookAuthorsPath, `
      create table book_authors (
        author_id integer,
        book_id   integer,
        foreign key (author_id)
                references authors (author_id),
        foreign key (book_id)
                references books (book_id)
      );
      ---
      drop table book_authors;
    `)
    await up({ files, journalTable })
    await client.query(`
      select *
        from books
        join book_authors using (book_id)
        join authors using (author_id)
    `)
  })

  it('aborts bad batches', async () => {
    const now = Date.now()
    const authorsFile = `${now}_authors.sql`
    const authorsPath = path.join(filesDir, authorsFile)
    fs.writeFileSync(authorsPath, `
      create table authors (
        author_id   serial,
        author_name text not null,
        primary key (author_id)
      );
      ---
      drop table authors;
    `)
    const dataFile = `${now + 1}_data.sql`
    const dataPath = path.join(filesDir, dataFile)
    fs.writeFileSync(dataPath, `
      insert into authors (author_name)
      values ('Donald Knuth');
      FAAAAKKK
      ---
      truncate table authors restart identity cascade;
    `)
    const err = await up({ files, journalTable }).catch(err => err)
    expect(err)
      .to.be.an('error')
      .with.property('message')
      .that.includes('FAAAAKKK')
    const { rows: applied } = await client.query(`
      select table_name
        from information_schema.tables
        where table_schema = 'public'
    `)
    expect(applied).to.have.lengthOf(0)
  })

})
