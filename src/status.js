const { red, green, cyan, white } = require('chalk')
const { log, begin, commit, rollback, loadJournal } = require('./helpers')
const { readPending } = require('./up')

module.exports = function status({ files, tableName }) {
  return begin()
    .then(client => {
      return loadJournal(client, tableName)
        .then(readPending(files))
        .then(({ fileNames }) => {
          log(red('[pg-bump]', green(`Found ${fileNames.length} pending migrations.`)))
          fileNames.forEach(fileName => log(cyan('pending:'), white(fileName)))
          return commit(client)().then(() => fileNames)
        })
        .catch(rollback(client))
    })
}
