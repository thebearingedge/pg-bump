const path = require('path')
const fs = require('fs-extra')
const { Client } = require('pg')
const { expect } = require('./__test__')
const down = require('./down')

describe('down()', () => {

  let client
  const now = Date.now()
  const files = 'migrations'
  const journalTable = 'schema_journal'
  const authorsFile = `${now}_authors.sql`
  const booksFile = `${now + 1}_books.sql`
  const filesDir = path.join(process.cwd(), files)
  const booksPath = path.join(filesDir, booksFile)
  const authorsPath = path.join(filesDir, authorsFile)
  const createBooks = `
    create table books (
      book_id    serial,
      book_title text not null,
      primary key (book_id)
    );
  `
  const createAuthors = `
    create table authors (
      author_id   serial,
      author_name text not null,
      primary key (author_id)
    );
  `
  beforeEach(async () => {
    fs.mkdirpSync(filesDir)
    fs.emptyDirSync(filesDir)
    fs.writeFileSync(booksPath, `
      ${createBooks}
      ---
      drop table books;
    `)
    fs.writeFileSync(authorsPath, `
      ${createAuthors}
      ---
      drop table authors;
    `)
    client = new Client(process.env.DATABASE_URL)
    await client.connect()
    await client.query('begin')
    await client.query(`
      create table ${journalTable} (
        applied_at timestamptz(6) not null default now(),
        file_name  text unique not null
      )
    `)
    await client.query(createAuthors)
    await client.query(createBooks)
    await client.query(`
      insert into schema_journal (file_name)
      values ('${authorsFile}'), ('${booksFile}');
    `)
    await client.query('commit')
  })

  afterEach(() => client.end())

  it('reverts all migrations', async () => {
    await down({ files, journalTable })
    const { rows: [{ table_name }] } = await client.query(`
      select table_name
        from information_schema.tables
        where table_schema = 'public'
    `)
    expect(table_name).to.equal(journalTable)
  })

  it('reverts all migrations once', async () => {
    await down({ files, journalTable })
    await down({ files, journalTable })
  })

  it('removes migrations from the journal', async () => {
    await down({ files, journalTable })
    const { rows: [{ count }] } = await client.query(`
      select count(*)::int from ${journalTable}
    `)
    expect(count).to.equal(0)
  })

  it('only reverts applied migrations', async () => {
    const bookAuthorsFile = `${Date.now()}_book_authors.sql`
    const bookAuthorsPath = path.join(filesDir, bookAuthorsFile)
    fs.writeFileSync(bookAuthorsPath, `
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
    await down({ files, journalTable })
  })

  it('aborts bad batches', async () => {
    fs.writeFileSync(booksPath, `
      ${createBooks}
      ---
      drop table books;
      FAAAAKKK
    `)
    const err = await down({ files, journalTable }).catch(err => err)
    expect(err)
      .to.be.an('error')
      .with.property('message')
      .that.includes('FAAAAKKK')
    const { rows: tables } = await client.query(`
      select table_name
        from information_schema.tables
        where table_schema = 'public'
    `)
     expect(tables).to.have.a.lengthOf(3)
  })

  it('only reverts applied migrations down to specified file', async () => {
    await down({ files, journalTable, to: authorsFile })
    const { rows: remaining } = await client.query(`
      select table_name
        from information_schema.tables
        where table_schema = 'public'
    `)
     expect(remaining).to.have.a.lengthOf(2)
  })

})
