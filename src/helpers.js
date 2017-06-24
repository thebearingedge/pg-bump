const path = require('path')
const fs = require('fs-extra')
const { Client } = require('pg')
const { red, yellow, green } = require('chalk')
const { log, logError } = require('./log')

const each = (collection, procedure, i = 0) => {
  if (!collection.length) return Promise.resolve()
  return procedure(collection[0], i)
    .then(() => each(collection.slice(1), procedure, i + 1))
}

const begin = connectionVar => new Promise((resolve, reject) => {
  const client = new Client(process.env[connectionVar])
  client.connect(err => {
    /* istanbul ignore next */
    if (err) return reject(err)
    client
      .query('begin')
      .then(() => resolve(client))
  })
})

const commit = client => () =>
  client
    .query('commit')
    .then(() => client.end())

const rollback = client => err =>
  client
    .query('rollback')
    .then(() => client.end())
    .then(() => Promise.reject(err))

const bootstrap = (client, journalTable, files) => {
  const [ table, schema = 'public' ] = journalTable.split('.').reverse()
  return client.query(`
    select table_name
      from information_schema.tables
     where table_schema = '${schema}'
       and table_name   = '${table}'
     fetch first row only
  `)
  .then(({ rows: [ found ] }) => {
    if (found) return
    log(red('[pg-bump]', green(`Creating "${journalTable}"`)))
    return client.query(`
      create table ${journalTable} (
        applied_at timestamptz(6) not null default now(),
        file_name  text unique not null
      )
    `)
  })
  .then(() => client.query(`
    select file_name
      from ${journalTable}
     order by file_name asc
  `))
  .then(({ rows }) => rows.map(({ file_name }) => file_name))
  .then(applied => {
    const filesDir = path.join(process.cwd(), files)
    fs.ensureDirSync(filesDir)
    const fileNames = fs.readdirSync(filesDir).sort()
    const isSynchronized = applied
      .every((migration, i) => migration === fileNames[i])
    if (isSynchronized) return { applied, fileNames, filesDir }
    const missing = applied
      .filter(fileName => !fileNames.includes(fileName))
      .map(fileName => ({ status: 'missing', fileName }))
    const untracked = fileNames
      .slice(0, applied.length - missing.length)
      .filter(fileName => !applied.includes(fileName))
      .map(fileName => ({ status: 'untracked', fileName }))
    const message = 'Migration history corrupted!\n' + missing
      .concat(untracked)
      .map(({ status, fileName }) => `${yellow(status + ' file:')} ${fileName}`)
      .join('\n')
    return Promise.reject(new Error(message))
  })
}

module.exports = {
  log,
  each,
  begin,
  commit,
  rollback,
  bootstrap,
  logError
}
