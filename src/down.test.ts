import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import { Sql } from 'postgres'
import down from './down.js'
import create from './create.js'
import { createSchemaTable } from './status.js'
import { files, journal, withSql } from './index.test.js'

describe('down', () => {

  let sql: Sql<{}>

  beforeEach(withSql(_sql => (sql = _sql)))

  it('reverts synced migrations and removes a journal entry', async () => {
    const { migration: foos } = create({ files, name: 'create-table-foos' })
    fs.writeFileSync(path.join(files, foos, 'down.sql'), 'drop table foos;')
    const { migration: bars } = create({ files, name: 'create-table-bars' })
    fs.writeFileSync(path.join(files, bars, 'down.sql'), 'drop table bars;')
    await sql.unsafe(createSchemaTable(journal))
    await sql`create table foos ();`
    await sql`create table bars ();`
    await sql`
      insert into ${sql(journal)}
      values (1, ${foos}),
             (2, ${bars})
    `
    const { isError } = await down({ sql, files, journal })
    expect(isError).to.equal(false)
    const [{ migrationCount }] = await sql<[{ migrationCount: number }]>`
      select count(*)::int as "migrationCount"
        from ${sql(journal)}
       where migration = ${foos}
          or migration = ${bars}
    `
    expect(migrationCount).to.equal(0)
    const [{ tableCount }] = await sql<[{ tableCount: number }]>`
      select count(*)::int as "tableCount"
        from information_schema.tables
       where table_schema = 'public'
         and (table_name = ${foos} or table_name = ${bars})
    `
    expect(tableCount).to.equal(0)
  })

  it('does not revert the same migration more than once', async () => {
    const { migration } = create({ files, name: 'create-table-foos' })
    fs.writeFileSync(path.join(files, migration, 'down.sql'), 'drop table foos;')
    await sql.unsafe(createSchemaTable(journal))
    await sql`create table foos ();`
    const { isError, reverted } = await down({ sql, files, journal })
    expect(isError).to.equal(false)
    expect(reverted).to.have.lengthOf(0)
    const [{ migrationCount }] = await sql<[{ migrationCount: number }]>`
      select count(*)::int as "migrationCount"
        from ${sql(journal)}
       where migration = ${migration}
    `
    expect(migrationCount).to.equal(0)
  })

  it('aborts migration when migrations are corrupt', async () => {
    await sql.unsafe(createSchemaTable(journal))
    await sql`
      insert into ${sql(journal)} (version, migration)
      values (${1}, ${`${Date.now()}_create-table-foos`})
    `
    const { isError, reverted } = await down({ sql, files, journal })
    expect(isError).to.equal(true)
    expect(reverted).to.have.lengthOf(0)
  })

  it('aborts migrations when scripts contain errors', async () => {
    const { migration } = create({ files, name: 'create-table-foos' })
    fs.writeFileSync(path.join(files, migration, 'down.sql'), `
      drop table foos;
      do $$ begin raise exception 'bork'; end $$;
    `)
    await sql.unsafe(createSchemaTable(journal))
    await sql`create table foos ();`
    await sql`
      insert into ${sql(journal)}
      values (1, ${migration})
    `
    const { isError, reverted, summary } = await down({ sql, files, journal })
    expect(isError).to.equal(true)
    expect(reverted).to.have.lengthOf(0)
    expect(summary.find(({ isError }) => isError)).not.to.equal(undefined)
    const [{ migrationCount }] = await sql<[{ migrationCount: number }]>`
      select count(*)::int as "migrationCount"
        from ${sql(journal)}
       where migration = ${migration}
    `
    expect(migrationCount).to.equal(1)
    const [{ tableCount }] = await sql <[{ tableCount: number }]>`
      select count(*)::int as "tableCount"
        from information_schema.tables
       where table_schema = 'public'
         and table_name = 'foos'
    `
    expect(tableCount).to.equal(1)
  })

  it('reverts migrations until an exception outside of transactions', async () => {
    const { migration: foos } = create({ files, name: 'create-table-foos' })
    fs.writeFileSync(path.join(files, foos, 'down.sql'), `
      drop table foos;
      do $$ begin raise exception 'bork'; end $$;
    `)
    await new Promise(resolve => setTimeout(resolve, 1))
    const { migration: bars } = create({ files, name: 'create-table-bars' })
    fs.writeFileSync(path.join(files, bars, 'down.sql'), 'drop table bars;')
    await sql.unsafe(createSchemaTable(journal))
    await sql`create table foos ();`
    await sql`create table bars ();`
    await sql`
      insert into ${sql(journal)}
      values (1, ${foos}),
             (2, ${bars})
    `
    const { isError, reverted, summary } = await down({ sql, files, journal, transaction: false })
    expect(isError).to.equal(true)
    expect(reverted).to.have.lengthOf(1)
    expect(summary.find(({ isError }) => isError)).not.to.equal(undefined)
    const [{ migrationCount }] = await sql<[{ migrationCount: number }]>`
      select count(*)::int as "migrationCount"
        from ${sql(journal)}
       where migration = ${foos}
          or migration = ${bars}
    `
    expect(migrationCount).to.equal(1)
    const [{ tableCount }] = await sql <[{ tableCount: number }]>`
      select count(*)::int as "tableCount"
        from information_schema.tables
       where table_schema = 'public'
         and (table_name = 'foos' or table_name = 'bars')
    `
    expect(tableCount).to.equal(1)
  })

  it('reverts migrations to a specified version', async () => {
    const { migration: foos } = create({ files, name: 'create-table-foos' })
    fs.writeFileSync(path.join(files, foos, 'down.sql'), 'drop table foos;')
    await new Promise(resolve => setTimeout(resolve, 1))
    const { migration: bars } = create({ files, name: 'create-table-bars' })
    fs.writeFileSync(path.join(files, bars, 'down.sql'), 'drop table bars;')
    await sql.unsafe(createSchemaTable(journal))
    await sql`create table foos ();`
    await sql`create table bars ();`
    await sql`
      insert into ${sql(journal)}
      values (1, ${foos}),
             (2, ${bars})
    `
    const { isError, reverted } = await down({ sql, files, journal, to: 1 })
    expect(isError).to.equal(false)
    expect(reverted).to.have.lengthOf(1)
    const [{ migrationCount }] = await sql<[{ migrationCount: number }]>`
      select count(*)::int as "migrationCount"
        from ${sql(journal)}
       where migration = ${foos}
          or migration = ${bars}
    `
    expect(migrationCount).to.equal(1)
    const [{ tableCount }] = await sql <[{ tableCount: number }]>`
      select count(*)::int as "tableCount"
        from information_schema.tables
       where table_schema = 'public'
         and (table_name = 'foos' or table_name = 'bars')
    `
    expect(tableCount).to.equal(1)
  })

})
