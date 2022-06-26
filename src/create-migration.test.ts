import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import createMigration from './create-migration'

describe('createMigration', () => {

  const files = './migrations'

  beforeEach('clear migrations dir', () => {
    const entries = fs.readdirSync(files, { withFileTypes: true })
    entries.forEach(entry => {
      if (entry.isDirectory()) fs.rmSync(path.join(files, entry.name), { recursive: true })
    })
  })

  it('creates a new migration script in a directory', () => {
    const directoryName = createMigration({ script: 'create-table-foos', files: files })
    const entries = fs.readdirSync(path.join(files, directoryName))
    expect(entries)
      .to.have.lengthOf(2)
      .to.include('up.sql')
      .and.to.include('down.sql')
  })

})
