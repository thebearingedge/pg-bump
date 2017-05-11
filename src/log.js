module.exports = function log(...args) {
  /* eslint-disable */
  (process.env.PGBUMP_ENV !== 'test') && console.log(...args)
}
