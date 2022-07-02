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

  afterEach(async () => await sql.end())

  it('applies pending migrations and appends a journal entry', async () => {
    const { migration } = create({ files, name: 'create-table-foos' })
    fs.writeFileSync(path.join(files, migration, 'down.sql'), 'drop table foos;')
    await sql.unsafe(createSchemaTable(journal))
    await sql`insert into ${sql(journal)} values (1, ${migration})`
    await sql`create table foos ();`
    const { isError } = await down({ sql, files, journal })
    expect(isError).to.equal(false)
    const [synced] = await sql`
      select 1
        from ${sql(journal)}
       where migration = ${migration}
    `
    expect(synced).to.equal(undefined)
    const [table] = await sql`
      select 1
        from information_schema.tables
       where table_name = 'foos'
         and table_schema = 'public'
    `
    expect(table).to.equal(undefined)
  })

})
