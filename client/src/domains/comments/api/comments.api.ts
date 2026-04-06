import { http } from '@/shared/api/http'
import { createCommentsHubClient, type CommentsHubClient } from './commentsHub'
import type { CommentDto, CommentHubRequest } from './types'

export type { CommentDto, CommentHubRequest, CommentsHubClient }

export function createCommentsRealtimeClient(): CommentsHubClient {
  return createCommentsHubClient()
}

type CurrentUserResponse = {
  domainUser?: {
    sid?: string
    Sid?: string
    displayName?: string
    DisplayName?: string
    name?: string
    Name?: string
  }
}

type DirectoryUser = {
  sid?: string
  Sid?: string
  name?: string
  Name?: string
}

type CurrentCommentAuthorProfile = {
  sid: string | null
  author: string | null
  aliases: string[]
}

const SID_PATTERN = /^S-\d-(?:-\d+)+$/i

let currentAuthorProfilePromise: Promise<CurrentCommentAuthorProfile> | null = null
let directoryUsersPromise: Promise<Map<string, string>> | null = null

function isSid(value: string): boolean {
  return SID_PATTERN.test(value.trim())
}

async function getCurrentCommentAuthorProfile(): Promise<CurrentCommentAuthorProfile> {
  if (!currentAuthorProfilePromise) {
    currentAuthorProfilePromise = http.get<CurrentUserResponse>('/User/current')
      .then(response => {
        const domainUser = response.data?.domainUser
        const sid = domainUser?.sid ?? domainUser?.Sid ?? null
        const displayName = domainUser?.displayName ?? domainUser?.DisplayName
        const name = domainUser?.name ?? domainUser?.Name
        const author = typeof displayName === 'string' && displayName.trim()
          ? displayName.trim()
          : (typeof name === 'string' && name.trim() ? name.trim() : null)
        const aliases = [sid, displayName, name]
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map(value => value.trim())

        return { sid, author, aliases }
      })
      .catch(() => ({ sid: null, author: null, aliases: [] }))
  }

  return await currentAuthorProfilePromise
}

async function getDirectoryUsersMap(): Promise<Map<string, string>> {
  if (!directoryUsersPromise) {
    directoryUsersPromise = http.get<DirectoryUser[]>('/ActiveDirectory/users')
      .then(response => {
        const users = Array.isArray(response.data) ? response.data : []
        const entries = users.flatMap(user => {
          const sid = user.sid ?? user.Sid
          const name = user.name ?? user.Name

          if (typeof sid !== 'string' || !sid.trim() || typeof name !== 'string' || !name.trim()) {
            return []
          }

          return [[sid.trim(), name.trim()] as const]
        })

        return new Map(entries)
      })
      .catch(() => new Map<string, string>())
  }

  return await directoryUsersPromise
}

export async function getCurrentCommentAuthor(): Promise<string | null> {
  const profile = await getCurrentCommentAuthorProfile()
  return profile.author
}

export async function getCurrentCommentAuthorSid(): Promise<string | null> {
  const profile = await getCurrentCommentAuthorProfile()
  return profile.sid
}

export async function getCurrentCommentAuthorAliases(): Promise<string[]> {
  const profile = await getCurrentCommentAuthorProfile()
  return profile.aliases
}

export async function resolveCommentAuthor(author: string): Promise<string> {
  if (!author.trim() || !isSid(author)) {
    return author
  }

  const profile = await getCurrentCommentAuthorProfile()
  if (profile.sid === author && profile.author) {
    return profile.author
  }

  const directoryUsers = await getDirectoryUsersMap()
  return directoryUsers.get(author) ?? author
}
