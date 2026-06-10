import { http } from '@/shared/api/http'

import type { DbConnectionRequest, DbTableInfo } from './db-info.types'

export async function fetchDbInfo(connection: DbConnectionRequest): Promise<DbTableInfo[]> {
  const response = await http.post<DbTableInfo[]>('/DbInfo', connection)
  return response.data
}
