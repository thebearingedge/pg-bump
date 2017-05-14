const path = require('path')
const fs = require('fs-extra')
const { red, green, white, cyan } = require('chalk')
const { log, bootstrap, begin, each, commit, rollback } = require('./helpers')

const readPending = () => ({ applied, fileNames, filesDir }) => {
  const pending = fileNames.filter(fileName => !applied.includes(fileName))
  const migrations = pending
    .map(fileName =>
      fs.readFileSync(path.join(filesDir, fileName), 'utf8').split(/-{3,}/)[0]
    )
  return { pending, migrations }
}

const apply = (client, tableName) => ({ pending, migrations }) => {
  if (!pending.length) {
    return log(red('[pg-bump]'), green('Already up to date.'))
  }
  log(red('[pg-bump]'), green(`Applying ${pending.length} migrations.`))
  return each(migrations, (migration, i) =>
    client
      .query(migration)
      .then(() => client.query(`
        insert into ${tableName} (file_name)
        values ('${pending[i]}')
      `))
      .then(() => log(cyan('applied:'), white(pending[i])))
      .catch(err => Promise.reject(Object.assign(err, {
        file: pending[i],
        migration
      })))
  )
}

module.exports = function up({ tableName, files }) {
  return begin()
    .then(client => {
      return bootstrap(client, tableName, files)
        .then(readPending())
        .then(apply(client, tableName))
        .then(commit(client))
        .catch(rollback(client))
    })
}

module.exports.readPending = readPending
