export type DbAuthenticationType = 'windows' | 'sql'

export interface DbConnectionRequest {
  server: string
  database: string
  username: string
  password: string
  authenticationType: DbAuthenticationType
}

export interface DbForeignKeyInfo {
  referencedTable: string
  referencedColumn: string
}

export interface DbColumnInfo {
  columnName: string
  columnDescription: string | null
  dataType: string
  maxLength: number
  precision: number
  scale: number
  foreignKeyInfo: DbForeignKeyInfo | null
}

export interface DbTableInfo {
  tableName: string
  tableDescription: string | null
  columns: DbColumnInfo[]
}
