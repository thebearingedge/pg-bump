const { red, green, cyan, white } = require('chalk')
const { log, begin, commit, rollback, bootstrap } = require('./helpers')
const { readPending } = require('./up')

module.exports = function status({ files, tableName }) {
  return begin()
    .then(client => {
      return bootstrap(client, tableName, files)
        .then(readPending())
        .then(({ pending }) => {
          log(red('[pg-bump]', green(`Found ${pending.length} pending migrations.`)))
          pending.forEach(fileName => log(cyan('pending:'), white(fileName)))
          return commit(client)().then(() => pending)
        })
        .catch(rollback(client))
    })
}
