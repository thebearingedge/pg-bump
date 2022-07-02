import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import { Sql } from 'postgres'
import up from './up.js'
import create from './create.js'
import { files, journal, withSql } from './index.test.js'

describe('up', () => {

  let sql: Sql<{}>

  beforeEach(withSql(_sql => (sql = _sql)))

  afterEach(async () => await sql.end())

  it('applies pending migrations and appends a journal entry', async () => {
    const { migration } = create({ files, name: 'create-table-foos' })
    fs.writeFileSync(path.join(files, migration, 'up.sql'), 'create table foos ();')
    const { isError } = await up({ sql, files, journal })
    expect(isError).to.equal(false)
    const [synced] = await sql`
      select 1
        from ${sql(journal)}
       where migration = ${migration}
    `
    expect(synced).not.to.equal(undefined)
    const [table] = await sql`select 1 from "foos"`
    expect(table).not.to.equal(undefined)
  })

})
