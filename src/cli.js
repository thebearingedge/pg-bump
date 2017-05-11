#! /usr/bin/env node
const yargs = require('yargs')
const create = require('./create')

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
  .help()
  .argv
