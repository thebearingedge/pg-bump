const path = require('path')
const fs = require('fs-extra')
const { Client } = require('pg')
const { expect } = require('./__test__')
const { execSync } = require('child_process')

describe('pg-bump', () => {

  let client
  const cwd = process.cwd()
  const filesDir = path.join(cwd, 'migrations')

  beforeEach(async () => {
    client = new Client(process.env.DATABASE_URL)
    await client.connect()
  })

  afterEach(() => client.end())

  describe('create <filename>', () => {

    beforeEach(() => fs.removeSync(filesDir))

    it('creates a new migration script in the default directory', () => {
      execSync('node lib/cli.js create foo')
      const [ created ] = fs.readdirSync(path.join(cwd, 'migrations'))
      expect(created).to.include('_foo.sql')
    })

    it('creates a new migration script in a custom directory', () => {
      execSync('node lib/cli.js create foo --files=./migrations/../migrations/bar')
      const [ created ] = fs.readdirSync(path.join(cwd, 'migrations/bar'))
      expect(created).to.include('_foo.sql')
    })

  })

  describe('up', () => {

    beforeEach(() => {
      fs.removeSync(filesDir)
      fs.mkdirpSync(filesDir)
    })

    it('applies pending migrations', async () => {
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
      execSync('node lib/cli.js up')
      const { rows: [{ author_name }] } = await client.query(`
        select author_name from authors
      `)
      expect(author_name).to.equal('Donald Knuth')
    })

  })

  describe('down [--to]', () => {

    beforeEach(async () => {
      fs.removeSync(filesDir)
      fs.mkdirpSync(filesDir)
      const authorsFile = `${Date.now()}_authors.sql`
      const authorsPath = path.join(filesDir, authorsFile)
      const authorsTable = `
        create table authors (
          author_id   serial,
          author_name text not null,
          primary key (author_id)
        );
      `
      fs.writeFileSync(authorsPath, `
        ${authorsTable}
        ---
        drop table authors;
      `)
      await client.query(`
        begin;

        create table schema_journal (
          version    integer        not null,
          file_name  text           not null,
          applied_at timestamptz(6) not null default now(),
          unique (version),
          unique (file_name)
        );

        insert into schema_journal (version, file_name)
        values (1, '${authorsFile}');

        ${authorsTable};

        commit;
      `)
    })

    it('reverts applied migrations', async () => {
      execSync('node lib/cli.js down')
      const { rows: tables } = await client.query(`
        select table_name
          from information_schema.tables
         where table_schema = 'public'
      `)
      expect(tables).to.have.a.lengthOf(1)
      const { rows: applied } = await client.query(`
        select * from schema_journal
      `)
      expect(applied).to.have.a.lengthOf(0)
    })

  })

  describe('status', () => {

    beforeEach(() => {
      fs.removeSync(filesDir)
      fs.mkdirpSync(filesDir)
    })

    it('reports a list of pending migrations', () => {
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

      const output = execSync('PGBUMP_ENV=cli node lib/cli.js status')
      expect(output.toString()).to.include('1 pending')
    })

  })

  describe('.pgbumprc', () => {

    const filesDir = path.join(cwd, '_migrations')
    const configPath = path.join(cwd, '.pgbumprc')

    beforeEach(() => {
      fs.writeFileSync(configPath, `
        {
          "files": "_migrations"
        }
      `)
    })

    afterEach(() => {
      fs.removeSync(filesDir)
      fs.removeSync(configPath)
    })

    it('configures pg-bump', () => {
      execSync('node lib/cli.js create foo')
      const [ created ] = fs.readdirSync(filesDir)
      expect(created).to.include('foo.sql')
    })

  })

})
