const path = require('path')
const fs = require('fs-extra')
const { red, green, white, cyan } = require('chalk')
const { log, loadJournal, begin, each, commit, rollback } = require('./helpers')

const readPending = files => applied => {
  const filesDir = path.resolve(process.cwd(), files)
  const fileNames = fs
    .readdirSync(filesDir)
    .filter(fileName => !applied.includes(fileName))
    .sort()
  const pending = fileNames.map(fileName =>
    fs.readFileSync(path.join(filesDir, fileName), 'utf8').split(/-{3,}/)[0]
  )
  return { fileNames, pending }
}

const apply = (client, tableName) => ({ fileNames, pending }) => {
  if (!fileNames.length) {
    return log(red('[pg-bump]'), green('Already up to date.'))
  }
  log(red('[pg-bump]'), green(`Applying ${fileNames.length} migrations.`))
  return each(pending, (migration, i) =>
    client
      .query(migration)
      .then(() => client.query(`
        insert into ${tableName} (file_name)
        values ('${fileNames[i]}')
      `))
      .then(() => log(cyan('applied:'), white(fileNames[i])))
      .catch(err => Promise.reject(Object.assign(err, {
        file: fileNames[i],
        migration
      })))
  )
}

module.exports = function up({ tableName, files }) {
  return begin()
    .then(client => {
      return loadJournal(client, tableName)
        .then(readPending(files))
        .then(apply(client, tableName))
        .then(commit(client))
        .catch(rollback(client))
    })
}
