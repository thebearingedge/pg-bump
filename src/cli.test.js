const path = require('path')
const fs = require('fs-extra')
const { Client } = require('pg')
const { execSync } = require('child_process')
const { describe, beforeEach, afterEach, it, expect } = require('./__test__')

describe('pg-bump', () => {

  let client
  const cwd = process.cwd()
  const filesDir = path.join(cwd, 'migrations')

  beforeEach(() => {
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

  describe('create <filename>', () => {

    beforeEach(() => fs.removeSync(filesDir))

    it('creates a new migration script in the default directory', () => {
      execSync('node src/cli.js create foo')
      const [ created ] = fs.readdirSync(path.join(cwd, 'migrations'))
      expect(created).to.include('_foo.sql')
    })

    it('creates a new migration script in a custom directory', () => {
      execSync('node src/cli.js create foo --files=./migrations/../migrations/bar')
      const [ created ] = fs.readdirSync(path.join(cwd, 'migrations/bar'))
      expect(created).to.include('_foo.sql')
    })

  })

  describe('up', () => {

    beforeEach(() => {
      fs.removeSync(filesDir)
      fs.mkdirpSync(filesDir)
    })

    it('applies pending migrations', () => {
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
        ---
        truncate table authors restart identity cascade;
      `)
      execSync('node src/cli.js up')
      return client
        .query('select author_name from authors')
        .then(({ rows: [{ author_name }] }) =>
          expect(author_name).to.equal('Donald Knuth')
        )
    })

  })

  describe('down [--to]', () => {

    beforeEach(() => {
      const authorsFile = `${Date.now()}_authors.sql`
      const authorsTable = `
        create table authors (
          author_id   serial,
          author_name text not null,
          primary key (author_id)
        );
      `
      fs.removeSync(filesDir)
      fs.mkdirpSync(filesDir)
      fs.writeFileSync(path.join(filesDir, authorsFile), `
        ${authorsTable}
        ---
        drop table authors;
      `)
      return client.query('begin')
        .then(() => client.query(`
          begin;

          create table schema_journal (
            applied_at timestamptz(6) not null default now(),
            file_name  text not null,
            unique (file_name)
          );

          insert into schema_journal (file_name)
          values ('${authorsFile}');

          ${authorsTable};

          commit;
        `))
    })

    it('reverts applied migrations', () => {
      execSync('node src/cli.js down')
      return client.query(`
        select table_name
          from information_schema.tables
         where table_schema = 'public'
      `)
      .then(({ rows }) => expect(rows).to.have.a.lengthOf(1))
      .then(() => client.query('select * from schema_journal'))
      .then(({ rows }) => expect(rows).to.have.a.lengthOf(0))
    })

  })

})
