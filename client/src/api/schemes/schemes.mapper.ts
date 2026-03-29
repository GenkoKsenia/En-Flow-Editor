import type { Scheme, SchemeVersion } from '@/models'

import type { SchemeResponseDto, SchemeVersionDto } from './schemes.dto'

export function mapSchemeVersionDtoToSchemeVersion(versionDto: SchemeVersionDto): SchemeVersion {
  return {
    id: String(versionDto.id),
    date: versionDto.date,
    schemeId: String(versionDto.schemeID),
    code: versionDto.code,
  }
}

export function mapSchemeDtoToScheme(schemeDto: SchemeResponseDto): Scheme {
  return {
    id: String(schemeDto.id),
    name: schemeDto.name,
    isReadOnly: Boolean(schemeDto.isReadOnly),
    favorite: Boolean(schemeDto.isFavorite),
    userId: schemeDto.userID ?? null,
    versions: (schemeDto.versions ?? []).map(mapSchemeVersionDtoToSchemeVersion),
  }
}
