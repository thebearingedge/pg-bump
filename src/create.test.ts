import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import create from './create.js'
import { files } from './index.test.js'

describe('create', () => {

  it('creates a new migration script in a directory', () => {
    const { migration } = create({ name: 'create-table-foos', files })
    const entries = fs.readdirSync(path.join(files, migration))
    expect(entries)
      .to.have.lengthOf(2)
      .to.include('up.sql')
      .and.to.include('down.sql')
  })

})
