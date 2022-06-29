import { Sql } from 'postgres'

type WithSqlOptions = {
  sql: Sql<{}>
  transaction: boolean
}

export default async function withSql<T>(
  { sql, transaction }: WithSqlOptions,
  procedure: (sql: Sql<{}>) => Promise<T>
): Promise<T> {
  try {
    let isLockAcquired = false
    while (!isLockAcquired) {
      [{ isLockAcquired }] = await sql<[{ isLockAcquired: boolean }]>`
        select pg_try_advisory_lock(-9223372036854775808) as "isLockAcquired"
      `
      if (!isLockAcquired) await new Promise(resolve => setTimeout(resolve, 1000))
    }
    const result: T = transaction
      ? await sql.begin(async sql => await procedure(sql)) as T
      : await procedure(sql)
    await sql`select pg_advisory_unlock(-9223372036854775808)`
    return result
  } finally {
    void sql.end()
  }
}
