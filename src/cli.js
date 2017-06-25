#! /usr/bin/env node
require('dotenv/config')
const yargs = require('yargs')
const fs = require('fs-extra')
const { create, up, down, status } = require('.')

yargs
  .usage('$0 <command> [args]')
  .option('config', {
    default: '.pgbumprc',
    config: true,
    configParser: path => fs.readJsonSync(path, { throws: false }),
    describe: 'Relative path to optional configuration file.'
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
    create
  )
  .command(
    'up',
    'Apply pending migrations.',
    yargs => yargs,
    up
  )
  .command(
    'down [--to|-t <filename>]',
    'Revert applied migrations.',
    yargs => yargs
      .option('to', {
        alias: 't',
        describe: 'Revert migrations down to but excluding <filename>.',
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
