const path = require('path')
const fs = require('fs-extra')
const { red, green, cyan, white } = require('chalk')
const log = require('./log')

const create = ({ filename, files }) => {

  log(red('[pg-bump]'), green('Creating migration file'))

  const file = `${Date.now()}_${path.parse(filename).name}.sql`
  const filesDir = path.resolve(process.cwd(), files)
  const filePath = path.join(filesDir, file)
  const templatePath = path.join(__dirname, 'template/default.sql')

  fs.mkdirpSync(filesDir)
  fs.copySync(templatePath, filePath)

  log(cyan('created:'), white(path.join(files, file)))

  return filePath
}

module.exports = create
