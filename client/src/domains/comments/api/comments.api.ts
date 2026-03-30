import { createCommentsHubClient, type CommentsHubClient } from './commentsHub'
import type { CommentDto, CommentHubRequest } from './types'

export type { CommentDto, CommentHubRequest, CommentsHubClient }

export function createCommentsRealtimeClient(): CommentsHubClient {
  return createCommentsHubClient()
}
