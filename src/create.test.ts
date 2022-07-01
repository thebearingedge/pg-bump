import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import create from './create.js'

describe('create', () => {

  const files = './sandbox/migrations'

  beforeEach('clear migrations dir', () => {
    fs.mkdirSync(files, { recursive: true })
    const entries = fs.readdirSync(files, { withFileTypes: true })
    entries.forEach(entry => {
      if (entry.isDirectory()) fs.rmSync(path.join(files, entry.name), { recursive: true })
    })
  })

  it('creates a new migration script in a directory', () => {
    const { migration } = create({ name: 'create-table-foos', files })
    const entries = fs.readdirSync(path.join(files, migration))
    expect(entries)
      .to.have.lengthOf(2)
      .to.include('up.sql')
      .and.to.include('down.sql')
  })

})
