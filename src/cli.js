#! /usr/bin/env node
const yargs = require('yargs')
const fs = require('fs-extra')
const { create, up, down, status } = require('.')

yargs
  .usage('$0 <command> [args]')
  .option('config', {
    default: '.pgbumprc',
    config: true,
    configParser: path => fs.readJsonSync(path, { throws: false }),
    describe: 'Relative path to configuration file.'
  })
  .option('connection', {
    alias: 'c',
    default: {},
    describe: 'Database connection configuration.'
  })
  .option('journalTable', {
    alias: 'j',
    default: 'schema_journal',
    describe: 'Database table used to record migration history.'
  })
  .option('files', {
    alias: 'f',
    default: 'migrations',
    describe: 'Relative path to migrations directory.',
  })
  .command(
    'create <filename>',
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
    'down [--to]',
    'Revert migrations',
    yargs => yargs
      .option('to', {
        alias: 't',
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
