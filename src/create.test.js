const path = require('path')
const fs = require('fs-extra')
const { describe, afterEach, it, expect } = require('./__test__')
const create = require('./create')

describe('create()', () => {

  const cwd = process.cwd()
  const templatePath = path.join(__dirname, 'template/default.sql')
  const template = fs.readFileSync(templatePath, 'utf8')

  afterEach(() => fs.removeSync(path.join(cwd, 'migrations')))

  it('creates a new migration script in a directory', () => {
    create({ filename: 'bar', files: 'migrations/../migrations/bar' })
    const filePath = path.resolve(cwd, 'migrations/../migrations/bar')
    const [ filename ] = fs.readdirSync(filePath, 'utf8')
    expect(filename).to.include('bar.sql')
    const file = fs.readFileSync(path.join(filePath, filename), 'utf8')
    expect(file).to.equal(template)
  })

})
