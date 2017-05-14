const path = require('path')
const fs = require('fs-extra')
const { white, red, green, cyan } = require('chalk')
const { log, begin, each, commit, rollback, bootstrap } = require('./helpers')

const readReverting = to => ({ applied, filesDir }) => {
  const reverting = applied.slice(applied.indexOf(to) + 1).reverse()
  const migrations = reverting
    .map(fileName =>
      fs.readFileSync(path.join(filesDir, fileName), 'utf8').split(/-{3,}/)[1]
    )
  return { reverting, migrations }
}

const revert = (client, tableName) => ({ reverting, migrations }) => {
  if (!reverting.length) {
    return log(red('[pg-bump]'), green('Already at base migration.'))
  }
  log(red('[pg-bump]'), green(`Reverting ${reverting.length} migrations.`))
  return each(migrations, (migration, i) =>
    client
      .query(migration)
      .then(() => client.query(`
        delete from ${tableName}
        where file_name = '${reverting[i]}'
      `))
      .then(() => log(cyan('reverted:'), white(reverting[i])))
      .catch(err => Promise.reject(Object.assign(err, {
        file: reverting[i],
        migration
      })))
  )
}

module.exports = function down({ files, to, tableName }) {
  return begin()
    .then(client => {
      return bootstrap(client, tableName, files)
        .then(readReverting(to))
        .then(revert(client, tableName))
        .then(commit(client))
        .catch(rollback(client))
    })
}