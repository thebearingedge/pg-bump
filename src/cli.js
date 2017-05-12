#! /usr/bin/env node
const yargs = require('yargs')
const create = require('./create')
const up = require('./up')

yargs
  .usage('$0 <command> [args]')
  .command(
    'create <filename> [options]',
    'Create a new migration file',
    yargs => yargs.option('f', {
      type: 'string',
      alias: 'files',
      default: './migrations',
      describe: 'Relative path to migrations directory.',
    }),
    create
  )
  .command(
    'up',
    'Run all pending migrations',
    yargs => yargs
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
      }),
    up
  )
  .help()
  .argv
