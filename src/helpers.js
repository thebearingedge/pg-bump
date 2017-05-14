const { Client } = require('pg')
const { red, white, yellow, green, bold } = require('chalk')

const log = (...args) => {
  // istanbul ignore next
  // eslint-disable-next-line no-console
  (process.env.PGBUMP_ENV !== 'test') && console.log(...args)
}

const each = (collection, procedure, i = 0) => {
  if (!collection.length) return Promise.resolve()
  return procedure(collection[0], i)
    .then(() => each(collection.slice(1), procedure, i + 1))
}

const begin = () => new Promise(resolve => {
  const client = new Client({})
  client.connect(() => client.query('begin').then(() => resolve(client)))
})

const commit = client => () =>
  client
    .query('commit')
    .then(() => client.end())

const rollback = client => err => {
  client
    .query('rollback')
    .then(() => client.end())
    .then(() => {
      log(red('\nABORTED:'), white(err.message), '\n')
      err.migration && log(bold(err.file), '\n', yellow(err.migration), '\n')
      log(white(err.stack))
      // istanbul ignore next
      if (process.env.PGBUMP_ENV !== 'test') process.exit(1)
    })
}

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
  .then(() => client.query(`
    select file_name
      from ${tableName}
     order by file_name asc
  `))
  .then(({ rows }) => rows.map(({ file_name }) => file_name))
}

module.exports = {
  log,
  each,
  begin,
  commit,
  rollback,
  loadJournal
}
