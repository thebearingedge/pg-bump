const path = require('path')
const fs = require('fs-extra')
const { Client } = require('pg')
const { red, green, white, cyan, yellow } = require('chalk')
const log = require('./log')

const each = (collection, procedure, i = 0) => {
  if (!collection.length) return Promise.resolve()
  return procedure(collection[0], i)
    .then(() => each(collection.slice(1), procedure, i + 1))
}

const begin = () => new Promise(resolve => {
  const client = new Client({})
  client.connect(() => client.query('begin').then(() => resolve(client)))
})

const rollback = client => err => {
  client
    .query('rollback')
    .then(() => client.end())
    .then(() => {
      log(red('\nABORTED:'), white(err.message), '\n')
      err.migration && log(yellow(err.migration), '\n')
      log(white(err.stack))
    })
}

const commit = client => () =>
  client
    .query('commit')
    .then(() => client.end())

const loadJournal = (client, tableName) => {
  const [ table, schema = 'public' ] = tableName.split('.').reverse()
  return client.query({
    values: [schema, table],
    text: (`
      select table_name
        from information_schema.tables
       where table_schema = $1
         and table_name   = $2
       fetch first row only
    `)
  })
  .then(({ rows: [ found ] }) => {
    if (found) return
    log(red('[pg-bump]', green(`Creating "${tableName}"`)))
    return client.query(`
      create table ${tableName} (
        applied_at timestamptz(6) not null default now(),
        file_name  text unique not null
      )
    `)
  })
  .then(() => client.query(`select file_name from ${tableName}`))
  .then(({ rows }) => rows.map(({ file_name }) => file_name))
}

const readPending = files => applied => {
  const filesDir = path.resolve(process.cwd(), files)
  const fileNames = fs
    .readdirSync(filesDir)
    .filter(fileName => !applied.includes(fileName))
    .sort()
  const pending = fileNames
    .map(fileName =>
      fs.readFileSync(path.join(filesDir, fileName), 'utf8').split(/-{3,}/)[0]
    )
  return { fileNames, pending }
}

const apply = (client, tableName) => ({ pending, fileNames }) => {
  if (!fileNames.length) {
    return log(white('No new migrations...'))
  }
  log(red('[pg-bump]'), green(`Applying ${fileNames.length} migrations`))
  return each(pending, (migration, i) =>
    client
      .query(migration)
      .then(() => log(cyan('applied:'), white(fileNames[i])))
      .catch(err => Promise.reject(Object.assign(err, { migration })))
  )
  .then(() => {
    const toInsert = fileNames.map(fileName => `('${fileName}')`)
    return client.query(`
      insert into ${tableName} (file_name)
      values ${toInsert.join(', ')}
    `)
  })
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
