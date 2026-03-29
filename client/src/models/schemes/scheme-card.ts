import type { Scheme } from './scheme'
import type { SchemeVersion } from './scheme-version'

export interface SchemeCard {
  id: string
  name: string
  updatedAt: string | null
  favorite: boolean
}

export function toSchemeCard(scheme: Scheme): SchemeCard {
  const latestVersion = scheme.versions.reduce<SchemeVersion | null>((latest, version) => {
    if (!latest) return version
    return new Date(version.date).getTime() > new Date(latest.date).getTime() ? version : latest
  }, null)

  return {
    id: scheme.id,
    name: scheme.name,
    updatedAt: latestVersion?.date ?? null,
    favorite: scheme.favorite,
  }
}
