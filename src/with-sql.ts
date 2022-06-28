import { Sql } from 'postgres'

type Procedure<T> = (sql: Sql<{}>) => Promise<T>

type WithSqlOptions = {
  sql: Sql<{}>
  transaction: boolean
}

export default async function withSql<T>(
  { sql, transaction }: WithSqlOptions,
  procedure: Procedure<T>
): Promise<T> {
  if (!transaction) return await procedure(sql)
  return await sql.begin(async sql => await procedure(sql)) as T
}
