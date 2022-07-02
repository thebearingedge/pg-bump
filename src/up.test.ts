import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import { Sql } from 'postgres'
import up from './up.js'
import create from './create.js'
import { createSchemaTable } from './status.js'
import { files, journal, withSql } from './index.test.js'

describe('up', () => {

  let sql: Sql<{}>

  beforeEach(withSql(_sql => (sql = _sql)))

  afterEach(async () => await sql.end())

  it('applies pending migrations and appends a journal entry', async () => {
    const { migration: foos } = create({ files, name: 'create-table-foos' })
    fs.writeFileSync(path.join(files, foos, 'up.sql'), 'create table foos ();')
    const { migration: bars } = create({ files, name: 'create-table-bars' })
    fs.writeFileSync(path.join(files, bars, 'up.sql'), 'create table bars ();')
    const { isError } = await up({ sql, files, journal })
    expect(isError).to.equal(false)
    const [{ migrationCount }] = await sql<[{ migrationCount: number }]>`
      select count(*)::int as "migrationCount"
        from ${sql(journal)}
       where migration = ${foos}
          or migration = ${bars}
    `
    expect(migrationCount).to.equal(2)
    const [{ tableCount }] = await sql <[{ tableCount: number }]>`
      select count(*)::int as "tableCount"
        from information_schema.tables
       where table_schema = 'public'
         and (table_name = 'foos' or table_name = 'bars')
    `
    expect(tableCount).to.equal(2)
  })

  it('does not apply the same migration more than once', async () => {
    const { migration } = create({ files, name: 'create-table-foos' })
    fs.writeFileSync(path.join(files, migration, 'up.sql'), 'create table foos ();')
    await up({ sql, files, journal })
    const { isError, applied } = await up({ sql, files, journal })
    expect(isError).to.equal(false)
    expect(applied).to.have.lengthOf(0)
    const [{ migrationCount }] = await sql<[{migrationCount: number }]>`
      select count(*)::int as "migrationCount"
        from ${sql(journal)}
       where migration = ${migration}
    `
    expect(migrationCount).to.equal(1)
  })

  it('aborts migration when migrations are corrupt', async () => {
    await sql.unsafe(createSchemaTable(journal))
    await sql`
      insert into ${sql(journal)} (version, migration)
      values (${1}, ${`${Date.now()}_create-table-foos`})
    `
    const { isError, applied } = await up({ sql, files, journal })
    expect(isError).to.equal(true)
    expect(applied).to.have.lengthOf(0)
  })

  it('aborts migrations when scripts contain errors', async () => {
    const { migration } = create({ files, name: 'create-table-foos' })
    fs.writeFileSync(path.join(files, migration, 'up.sql'), 'create table foos (\'fuck you\');')
    const { isError, applied, summary } = await up({ sql, files, journal })
    expect(isError).to.equal(true)
    expect(applied).to.have.lengthOf(0)
    expect(summary.find(({ isError }) => isError)).not.to.equal(undefined)
  })

  it('applies migrations until an exception outside of transactions', async () => {
    create({ files, name: 'create-table-foos' })
    create({ files, name: 'create-table-bars' })
    await new Promise(resolve => setTimeout(resolve))
    const { migration } = create({ files, name: 'create-table-bazzes' })
    fs.writeFileSync(path.join(files, migration, 'up.sql'), 'create table bazzes (\'fuck you\');')
    const { isError, applied, summary } = await up({ sql, files, journal, transaction: false })
    expect(isError).to.equal(true)
    expect(applied).to.have.lengthOf(2)
    expect(summary.find(({ isError }) => isError)).not.to.equal(undefined)
  })

})
