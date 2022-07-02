pg-bump
--

SQL migration CLI for PostgreSQL.

[![Github Actions Test Status](https://github.com/thebearingedge/pg-bump/workflows/Test/badge.svg?branch=main)](https://github.com/thebearingedge/pg-bump/actions?query=workflow%3ATest+branch%3Amain)
[![codecov](https://codecov.io/gh/thebearingedge/pg-bump/branch/main/graph/badge.svg)](https://codecov.io/gh/thebearingedge/pg-bump)
[![Greenkeeper badge](https://badges.greenkeeper.io/thebearingedge/pg-bump.svg)](https://greenkeeper.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is it?

`pg-bump` provides command line management of PostgreSQL database schema migrations authored in "Plain SQL". It presumes that **a)** you are [checking schema migrations into source control](https://blog.codinghorror.com/get-your-database-under-version-control/) and **b)** you are [using environment variables for your application configuration](https://12factor.net/config).

`pg-bump` is primarily intended for use as an executable in [`package.json` scripts](https://docs.npmjs.com/misc/scripts). By default, applying or reverting migrations is run in a single transaction. However, this can be disabled via command line options.

## ESM-only

As of v4, `pg-bump` is an [ECMAScript module](https://nodejs.org/api/esm.html). This should not matter much as it is intended to be used as a CLI application and ESM has been supported since Node.js v12. v3 is still CommonJS.

## Powered by [`@porsager/postgres`](https://github.com/porsager/postgres)

As of v4, `pg-bump` connects to PostgreSQL with the `postgres` package instead of `pg`.

## Installation

To add `pg-bump` to your `dependencies` do:

```bash
λ npm i pg-bump
```

It is possible to install `pg-bump` globally, but I never recommend global installs and I don't know why some people still suggest it.

```bash
λ npm i -g pg-bump
```

## Commands

You can view the CLI documentation using `npx pg-bump --help`.

```
Usage: pg-bump [options] [command]

SQL migration CLI for PostgreSQL.

Options:
  -v, --version             output the version number
  -c, --config-path <path>  relative path to config file
  -r, --require <hook...>   require modules for side effects
  -f, --files <path>        relative path to migrations directory
  -e, --env-var <variable>  database url environment variable
  -j, --journal <table>     table used to record migration history
  -h, --help                display help for command

Commands:
  make|create <migration>   create a new migration file
  status                    show pending migrations
  up [options]              apply pending migrations
  down [options]            revert synced migrations
  help [command]            display help for command
```

## Creating a Migration

The `pg-bump make` command generates new `.sql` migrations in your migrations directory (defaults to `./migrations`). The migration is split into two files: `up.sql` and `down.sql`.

```shell
λ npx pg-bump make --help
# Usage: pg-bump make|create [options] <migration>
#
# create a new migration file
#
# Arguments:
#   migration   name of new migration
#
# Options:
#   -h, --help  display help for command
```

### Example


```shell
λ npx pg-bump make create_table_users
# [pg-bump]  created: <unix-time-in-ms>_create-table-users/{up,down}.sql

λ tree migrations
# migrations/
# └── <unix-time-in-ms>_create-table-users
#     ├── down.sql
#     └── up.sql
```

## Applying Migrations

The `pg-bump up` command applies all pending migrations.

```shell
λ npx pg-bump up --help
# Usage: pg-bump up [options]
#
# apply pending migrations
#
# Options:
#   -l, --lock         acquire advisory lock during migration (default: true)
#   --no-lock          skip advisory lock during migration
#   -t, --transaction  wrap migrations in a transaction (default: true)
#   --no-transaction   do not run migrations in a transaction
#   -h, --help         display help for command
```

### Example

```shell
λ npx pg-bump up
# [pg-bump] applied 3 migrations
#        1: 1656785255267_create-table-foos
#        2: 1656785259822_create-table-bars
#        3: 1656785263539_create-table-bazzes
```

## Reverting Migrations

The `pg-bump down` command reverts migrations. Include `--to <version>` to only revert migrations to, but not including `<version>`.

```shell
λ npx pg-bump down --help
# Usage: pg-bump down [options]
#
# revert synced migrations
#
# Options:
#   --no-lock          skip advisory lock during migration
#   -l, --lock         acquire advisory lock during migration (default: true)
#   --no-transaction   do not run migrations in a transaction
#   -t, --transaction  wrap migrations in a transaction (default: true)
#   --to <version>     revert to schema <version>
#   -h, --help         display help for command
```

### Example

```shell
λ npx pg-bump down
# [pg-bump] reverted 3 migrations
#        3: 1656785263539_create-table-bazzes
#        2: 1656785259822_create-table-bars
#        1: 1656785255267_create-table-foos
```

## Inspecting Migration State

List applied and pending migrations with the `pg-bump status` command.

```shell
λ npx pg-bump status --help
# Usage: pg-bump status [options]
#
# list applied and pending migrations
#
# Options:
#   -h, --help  display help for command
```

### Example

```shell
λ npx pg-bump status
# [pg-bump] found 1 pending migration
#        1: 1656785255267_create-table-foos
#        2: 1656785259822_create-table-bars
# (pending) 1656785263539_create-table-bazzes
```

## Development

Contributions welcome! If you add functionality or options, please include tests.

### Environment Variables and Docker

[`docker-compose`](https://docs.docker.com/compose/) can be used to start and stop a local PostgreSQL instance if you don't have a server running on your machine. If necessary, you can [override `docker-compose.yml`](https://docs.docker.com/compose/extends/#understanding-multiple-compose-files).

#### Copy the `.env` Template

```shell
cp .env.example .env
```

#### Start PostgreSQL Container and `pgweb`

```shell
docker-compose up --build -d
```

#### Run Tests

```shell
npm test
```

#### Generate Coverage Report

```shell
npm run cover
```
