require('dotenv/config')
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

  afterEach(() => client.end())

  it('creates a journal table', () => {
    return up({ files, tableName })
      .then(() => client.query(`
        select table_name
          from information_schema.tables
         where table_schema = 'public'
           and table_type   = 'BASE TABLE'
      `))
      .then(({ rows }) => expect(rows).to.have.deep.members([
        { table_name: 'schema_journal' }
      ]))
  })

  it('only creates a journal table once', () => {
    return up({ files, tableName })
      .then(() => up({ files, tableName }))
  })

  it('executes a migration script', () => {
    const filePath = path.join(filesDir, `${Date.now()}_books.sql`)
    fs.writeFileSync(filePath, `
      create table books (
        title text not null
      );
    `)
    return up({ files, tableName })
      .then(() => client.query('select * from books'))
      .then(({ rowCount }) => expect(rowCount).to.equal(0))
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
    return up({ files, tableName })
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
    return up({ files, tableName })
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
    return up({ files, tableName })
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
        return up({ files, tableName })
          .then(() => client.query(`
            select *
              from books
              join book_authors using (book_id)
              join authors using (author_id)
          `))
      })
  })

})
