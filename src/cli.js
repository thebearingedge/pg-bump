#! /usr/bin/env node
const yargs = require('yargs')
const { create, up, down, status } = require('.')

yargs
  .usage('$0 <command> [args]')
  .option('f', {
    type: 'string',
    alias: 'files',
    default: './migrations',
    describe: 'Relative path to migrations directory.',
  })
  .option('j', {
    type: 'string',
    alias: 'tableName',
    default: 'schema_journal',
    describe: 'Database table used to record migration history.'
  })
  .option('f', {
    type: 'string',
    alias: 'files',
    default: './migrations',
    describe: 'Relative path to migrations directory.',
  })
  .command(
    'create <filename> [options]',
    'Create a new migration file',
    yargs => yargs,
    create
  )
  .command(
    'up',
    'Run all pending migrations',
    yargs => yargs,
    up
  )
  .command(
    'down',
    'Revert migrations',
    yargs => yargs
      .option('t', {
        type: 'string',
        alias: 'to',
        default: '',
        describe: 'Revert migrations up to and excluding.',
      }),
    down
  )
  .command(
    'status',
    'Show pending migrations',
    yargs => yargs,
    status
  )
  .help()
  .argv
