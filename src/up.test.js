const path = require('path')
const fs = require('fs-extra')
const { Client } = require('pg')
const { describe, beforeEach, afterEach, it, expect } = require('./__test__')
const up = require('./up')

describe('up()', () => {

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

  it('executes a migration script', () => {
    const filePath = path.join(filesDir, `${Date.now()}_books.sql`)
    fs.writeFileSync(filePath, `
      create table books (
        title text not null
      );
    `)
    return up({ files, journalTable })
      .then(() => client.query('select * from books'))
      .then(({ rowCount }) => expect(rowCount).to.equal(0))
  })

  it('executes a migration script once', () => {
    const filePath = path.join(filesDir, `${Date.now()}_books.sql`)
    fs.writeFileSync(filePath, `
      create table books (
        title text not null
      );
    `)
    return up({ files, journalTable })
      .then(() => up({ files, journalTable }))
  })

  it('executes migration scripts in order', () => {
    const now = Date.now()
    const authorsPath = path.join(filesDir, `${now}_authors.sql`)
    fs.writeFileSync(authorsPath, `
      create table authors (
        author_id   serial,
        author_name text not null,
        primary key (author_id)
      );
    `)
    const booksPath = path.join(filesDir, `${now + 1}_books.sql`)
    fs.writeFileSync(booksPath, `
      create table books (
        book_id    serial,
        book_title text not null,
        author_id  integer not null,
        foreign key (author_id)
                references authors (author_id)
      );
    `)
    return up({ files, journalTable })
      .then(() => client.query(`
        select *
          from authors
          join books using (author_id)
      `))
  })

  it('only executes the "up" portion of migration scripts', () => {
    const now = Date.now()
    const authorsPath = path.join(filesDir, `${now}_authors.sql`)
    fs.writeFileSync(authorsPath, `
      create table authors (
        author_id   serial,
        author_name text not null,
        primary key (author_id)
      );
      ---
      drop table authors;
    `)
    const booksPath = path.join(filesDir, `${now + 1}_books.sql`)
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
    return up({ files, journalTable })
      .then(() => client.query(`
        select *
          from authors
          join books using (author_id)
      `))
  })

  it('only executes pending migration scripts', () => {
    const now = Date.now()
    const authorsPath = path.join(filesDir, `${now}_authors.sql`)
    fs.writeFileSync(authorsPath, `
      create table authors (
        author_id   serial,
        author_name text not null,
        primary key (author_id)
      );
      ---
      drop table authors;
    `)
    const booksPath = path.join(filesDir, `${now + 1}_books.sql`)
    fs.writeFileSync(booksPath, `
      create table books (
        book_id    serial,
        book_title text not null,
        primary key (book_id)
      );
      ---
      drop table books;
    `)
    return up({ files, journalTable })
      .then(() => {
        const bookAuthorsPath = path.join(filesDir, `${now + 2}_book_authors.sql`)
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
        return up({ files, journalTable })
          .then(() => client.query(`
            select *
              from books
              join book_authors using (book_id)
              join authors using (author_id)
          `))
      })
  })

  it('aborts bad batches', () => {
    const now = Date.now()
    const authorsTable = `${now}_authors.sql`
    fs.writeFileSync(path.join(filesDir, authorsTable), `
      create table authors (
        author_id   serial,
        author_name text not null,
        primary key (author_id)
      );
      ---
      drop table authors;
    `)
    const authorsData = `${now + 1}_authors_data.sql`
    fs.writeFileSync(path.join(filesDir, authorsData), `
      insert into authors (author_name)
      values ('Donald Knuth');
      FAAAAKKK
      ---
      truncate table authors restart identity cascade;
    `)
    return up({ files, journalTable })
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
      .then(({ rows }) => expect(rows).to.have.lengthOf(0))
  })

})
