import { http } from '@/shared/api/http'
import type { SchemeVersionDto } from '@/domains/schemes/api/schemes.dto'
import { mapSchemeVersionDtoToSchemeVersion } from '@/domains/schemes/mappers'
import type { SchemeVersion } from '@/domains/schemes'

export interface CodeDifferenceDto {
  propertyName: string
  firstObjectValue: string | null
  secondObjectValue: string | null
}

export async function getVersionsByScheme(schemeId: string | number): Promise<SchemeVersion[]> {
  const response = await http.get<SchemeVersionDto[]>(`/Version/${schemeId}`)
  return response.data.map(mapSchemeVersionDtoToSchemeVersion)
}

export async function getLatestVersionChanges(schemeId: string | number): Promise<CodeDifferenceDto[]> {
  const response = await http.get<CodeDifferenceDto[]>(`/Scheme/changes/${schemeId}`)
  return response.data.map(item => ({
    propertyName: item.propertyName,
    firstObjectValue: item.firstObjectValue ?? null,
    secondObjectValue: item.secondObjectValue ?? null,
  }))
}

export async function updateVersion(versionId: string | number, code: unknown): Promise<void> {
  await http.put(`/Version/put/${versionId}`, code, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
