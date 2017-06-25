pg-bump
--

An opinionated, minimalist SQL migration CLI for PostgreSQL.

[![Build Status](https://travis-ci.org/thebearingedge/pg-bump.svg?branch=master)](https://travis-ci.org/thebearingedge/pg-bump)
[![codecov](https://codecov.io/gh/thebearingedge/pg-bump/branch/master/graph/badge.svg)](https://codecov.io/gh/thebearingedge/pg-bump)
[![Greenkeeper badge](https://badges.greenkeeper.io/thebearingedge/pg-bump.svg)](https://greenkeeper.io/)
[![dependencies Status](https://david-dm.org/thebearingedge/pg-bump/status.svg)](https://david-dm.org/thebearingedge/pg-bump)
[![devDependencies Status](https://david-dm.org/thebearingedge/pg-bump/dev-status.svg)](https://david-dm.org/thebearingedge/pg-bump?type=dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

### What is it?

`pg-bump` provides command line management of PostgreSQL database schema migrations authored in "Plain SQL". It presumes that **a)** you are [checking schema migrations into source control](https://blog.codinghorror.com/get-your-database-under-version-control/) and **b)** you are [using environment variables for your application configuration](https://12factor.net/config). `pg-bump` is primarily intended for use as an executable in [`package.json` scripts](https://docs.npmjs.com/misc/scripts). Applying or reverting migrations is always run in a single transaction, ensuring atomic schema transitions.

### Installation

To add `pg-bump` to your `devDependencies` do:

```bash
λ npm i -D pg-bump
```

It is possible to install `pg-bump` globally, but it's not recommended.

```bash
λ npm i -g pg-bump
```

### Usage

```bash
pg-bump <command> [args]

Commands:
  create <filename>          Create a new migration file.
  up                         Apply pending migrations.
  down [--to|-t <filename>]  Revert applied migrations.
  status                     Show pending migrations

Options:
  --config             Relative path to optional configuration file.
                                                          [default: ".pgbumprc"]
  --connectionVar, -c  Connection string environment variable.
                                                       [default: "DATABASE_URL"]
  --journalTable, -j   Database table used to record migration history.
                                                     [default: "schema_journal"]
  --files, -f          Relative path to migrations directory.
                                                         [default: "migrations"]
  --help               Show help                                       [boolean]
```

### `.pgbumprc`

`pg-bump` will attempt to find an optional `.pgbumprc` configuration file in the root of `process.cwd()`. Here is an example with default settings:

```json
{
  "connectionVar": "DATABASE_URL",
  "journalTable": "schema_journal",
  "files": "./migrations"
}
```

#### `config.connectionVar`

The environment variable that `pg-bump` will use to connect to your PostgreSQL server. Defaults to `DATABASE_URL`. Should you forgo configuring a `connectionVar` and/or exporting an environment variable, `pg-bump` will attempt to connect using the [`pg` module's default behavior](https://github.com/brianc/node-postgres/wiki/Client#new-client-client). You should be using [`dotenv`](https://www.npmjs.com/package/dotenv), so if you include some `connectionVar`, e.g. `POSTGRESL_URL`, in your `.env` file, `pg-bump` use that to connect.

#### `config.journalTable`

The database table that `pg-bump` will use to record the names of applied migrations. Defaults to `schema_journal`. This table will be created for you by `pg-bump`.

```sql
create table schema_journal (
  applied_at timestamptz(6) not null default now(),
  file_name  text unique not null
);
```

#### `config.files`

The directory in your project that `pg-bump` will use to generate and read `.sql` migration files. Defaults to `./migrations`. This directory will be created for you by `pg-bump`.

```bash
project/
├─ node_modules/
├─ migrations/
├─ package.json
├─ .env
└─ .pgbumprc
```

### Example `package.json`

```json
{
  "name": "postgres-app",
  "version": "1.0.0",
  "description": "A node app that uses PostgreSQL.",
  "main": "index.js",
  "scripts": {
    "db:make": "pg-bump create",
    "db:up": "pg-bump up",
    "db:down": "pg-bump down",
    "db:status": "pg-bump status",
    "db:rebuild": "pg-bump down && pg-bump up"
  },
  "dependencies": {
    "dotenv": "^4.0.0"
  },
  "devDependencies": {
    "pg-bump": "^1.0.0"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
```

### Example `.pgbumprc`

```json
{
  "connectionVar": "POSTGRES_URL",
  "journalTable": "pg_bump_migrations",
  "files": "./db/migrations"
}
```
