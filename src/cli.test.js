const path = require('path')
const fs = require('fs-extra')
const { execSync } = require('child_process')
const { describe, afterEach, it, expect } = require('./__test__')

describe('pg-bump', () => {

  describe('create <filename>', () => {

    const cwd = process.cwd()

    afterEach(() => fs.removeSync(path.join(cwd, 'migrations')))

    it('creates a new migration script in the default directory', () => {
      execSync('node src/cli.js create foo')
      const [ created ] = fs.readdirSync(path.join(cwd, 'migrations'))
      expect(created).to.include('_foo.sql')
    })

    it('creates a new migration script in a custom directory', () => {
      execSync('node src/cli.js create foo --files=./migrations/../migrations/bar')
      const [ created ] = fs.readdirSync(path.join(cwd, 'migrations/bar'))
      expect(created).to.include('_foo.sql')
    })

  })

})
