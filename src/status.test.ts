import { expect } from 'chai'
import { type Sql } from 'postgres'
import create from './create.js'
import status, { createSchemaTable } from './status.js'
import { files, journal, withSql } from './index.test.js'

describe('status', () => {

  let sql: Sql

  beforeEach(withSql(_sql => (sql = _sql)))

  it('ensures a schema journal table is created', async () => {
    const { schemaTable } = await status({ sql, files, journal })
    expect(schemaTable).to.equal('"schema_journal"')
    const [table] = await sql`
      select 1
        from information_schema.tables
       where table_name = ${journal}
    `
    expect(table).not.to.equal(undefined)
  })

  it('reports pending migrations', async () => {
    const { migration } = create({ files, name: 'create-table-foos' })
    const { pending, summary } = await status({ sql, files, journal, printStatus: true })
    expect(pending).to.have.lengthOf(1)
    expect(pending[0]).to.have.property('migration', migration)
    const report = summary.find(({ message }) => message.includes('1 pending migration'))
    expect(report).not.to.equal(undefined)
  })

  it('reports synced migrations', async () => {
    const { migration } = create({ files, name: 'create-table-foos' })
    await sql.unsafe(createSchemaTable(journal))
    await sql`insert into ${sql(journal)} (version, migration) values (1, ${migration})`
    const { pending, summary } = await status({ sql, files, journal, printStatus: true })
    expect(pending).to.have.lengthOf(0)
    const report = summary.find(({ message }) => message.includes('0 pending migration'))
    expect(report).not.to.equal(undefined)
  })

})
