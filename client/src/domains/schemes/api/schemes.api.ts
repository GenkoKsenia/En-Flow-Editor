import { http } from '@/shared/api/http'

import type { Scheme } from '../models'

import type { SchemeResponseDto } from './schemes.dto'
import { mapSchemeDtoToScheme } from '../mappers'

export async function getSchemes(): Promise<Scheme[]> {
  const response = await http.get<SchemeResponseDto[]>('/Scheme')
  return response.data.map(mapSchemeDtoToScheme)
}

export async function getSchemeById(id: string | number): Promise<Scheme> {
  const response = await http.get<SchemeResponseDto>(`/Scheme/${id}`)
  return mapSchemeDtoToScheme(response.data)
}

export async function createScheme(name: string): Promise<Scheme> {
  const response = await http.post<SchemeResponseDto>('/Scheme/post', JSON.stringify(name), {
    headers: {
      'Content-Type': 'application/json',
    },
  })

  return mapSchemeDtoToScheme(response.data)
}

export async function deleteScheme(id: string | number): Promise<void> {
  await http.delete(`/Scheme/delete/${id}`)
}
