#! /usr/bin/env node
const yargs = require('yargs')
const fs = require('fs-extra')
const { create, up, down, status } = require('.')

const withOverrides = command => argv => command({ ...argv, ...argv[argv.db] })

yargs
  .usage('$0 <command> [args]')
  .pkgConf('pgBump')
  .option('config', {
    default: '.pgbumprc',
    config: true,
    configParser: path => fs.readJsonSync(path, { throws: false }),
    describe: 'Relative path to optional configuration file.'
  })
  .option('db', {
    alias: 'd',
    describe: 'Specify settings by config key.'
  })
  .option('require', {
    alias: 'r',
    describe: 'Require the given module.',
    coerce: /* istanbul ignore next */ hooks => {
      const cwd = process.cwd()
      Array.isArray(hooks)
        ? hooks.forEach(hook => require(require.resolve(hook, { paths: [cwd] })))
        : require(require.resolve(hooks, { paths: [cwd] }))
    }
  })
  .option('connectionVar', {
    alias: 'c',
    default: 'DATABASE_URL',
    describe: 'Connection string environment variable.'
  })
  .option('journalTable', {
    alias: 'j',
    default: 'schema_journal',
    describe: 'Database table used to record migration history.'
  })
  .option('files', {
    alias: 'f',
    default: './migrations',
    describe: 'Relative path to migrations directory.',
  })
  .command(
    'create <filename>',
    'Create a new migration file.',
    yargs => yargs,
    withOverrides(create)
  )
  .command(
    'up',
    'Apply pending migrations.',
    yargs => yargs,
    withOverrides(up)
  )
  .command(
    'down [--to|-t <filename>]',
    'Revert applied migrations.',
    yargs => yargs
      .option('to', {
        alias: 't',
        describe: 'Revert migrations down to but excluding <filename>.',
      }),
    withOverrides(down)
  )
  .command(
    'status',
    'Show pending migrations',
    yargs => yargs,
    withOverrides(status)
  )
  .help()
  .argv
