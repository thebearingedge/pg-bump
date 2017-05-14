const path = require('path')
const fs = require('fs-extra')
const { white, red, green, cyan } = require('chalk')
const { log, begin, each, commit, rollback, loadJournal } = require('./helpers')

const readReverting = (files, to) => applied => {
  const filesDir = path.resolve(process.cwd(), files)
  const fileNames = applied
    .slice(applied.indexOf(to) + 1)
    .reverse()
  const reverting = fileNames.map(fileName =>
    fs.readFileSync(path.join(filesDir, fileName), 'utf8').split(/-{3,}/)[1]
  )
  return { fileNames, reverting }
}

const revert = (client, tableName) => ({ fileNames, reverting }) => {
  if (!fileNames.length) {
    return log(red('[pg-bump]'), green('Already at base migration.'))
  }
  log(red('[pg-bump]'), green(`Reverting ${fileNames.length} migrations.`))
  return each(reverting, (migration, i) =>
    client
      .query(migration)
      .then(() => client.query(`
        delete from ${tableName}
        where file_name = '${fileNames[i]}'
      `))
      .then(() => log(cyan('reverted:'), white(fileNames[i])))
      .catch(err => Promise.reject(Object.assign(err, {
        file: fileNames[i],
        migration
      })))
  )
}

module.exports = function down({ files, to, tableName }) {
  return begin()
    .then(client => {
      return loadJournal(client, tableName)
        .then(readReverting(files, to))
        .then(revert(client, tableName))
        .then(commit(client))
        .catch(rollback(client))
    })
}
