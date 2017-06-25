const { red, white, yellow, bold } = require('chalk')

const log = (...args) => {
  // eslint-disable-next-line no-console
  (process.env.PGBUMP_ENV !== 'test') && console.log(...args)
}

const logError = () => err => {
  log(red('\nABORTED:'), white(err.message), '\n')
  err.migration && log(bold(err.file), '\n', yellow(err.migration), '\n')
  if (process.env.PGBUMP_ENV !== 'test') process.exit(1)
  return Promise.reject(err)
}

module.exports = { log, logError }
