import { type Sql } from 'postgres'

type WithSqlOptions = {
  sql: Sql
  lock?: boolean
  transaction?: boolean
}

export default async function withSql<T>(
  { sql, lock = false, transaction = false }: WithSqlOptions,
  procedure: (sql: Sql) => Promise<T>
): Promise<T> {
  try {
    let isLockAcquired = !lock
    while (!isLockAcquired) {
      [{ isLockAcquired }] = await sql<[{ isLockAcquired: boolean }]>`
        select pg_try_advisory_lock(-9223372036854775808) as "isLockAcquired"
      `
      if (!isLockAcquired) await new Promise(resolve => setTimeout(resolve, 1000))
    }
    const result: T = transaction
      ? await sql.begin(async sql => await procedure(sql)) as T
      : await procedure(sql)
    lock && await sql`select pg_advisory_unlock(-9223372036854775808)`
    return result
  } finally {
    void sql.end()
  }
}
