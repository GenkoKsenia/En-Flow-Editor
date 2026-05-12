import { http } from '@/shared/api/http'

type CurrentUserDto = {
  sid?: string
  Sid?: string
  name?: string
  Name?: string
  displayName?: string
  DisplayName?: string
}

type CurrentUserResponse = CurrentUserDto & {
  domainUser?: CurrentUserDto
}

export type CurrentUser = {
  sid: string | null
  name: string | null
}

function normalizeValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await http.get<CurrentUserResponse>('/User/current')
  const payload = response.data?.domainUser ?? response.data

  return {
    sid: normalizeValue(payload?.sid ?? payload?.Sid),
    name: normalizeValue(
      payload?.displayName
      ?? payload?.DisplayName
      ?? payload?.name
      ?? payload?.Name,
    ),
  }
}
