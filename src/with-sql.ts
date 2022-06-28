import { Sql } from 'postgres'

type WithSqlOptions = {
  sql: Sql<{}>
  transaction: boolean
}

export default async function withSql<T>(
  { sql, transaction }: WithSqlOptions,
  procedure: (sql: Sql<{}>) => Promise<T>
): Promise<T> {
  return transaction
    ? await sql.begin(async sql => await procedure(sql)) as T
    : await procedure(sql)
}
