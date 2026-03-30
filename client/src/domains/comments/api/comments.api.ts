import {
  createCommentsHubClient,
  type CommentDto,
  type CommentHubRequest,
  type CommentsHubClient,
} from '@/domains/collaboration'

export type { CommentDto, CommentHubRequest, CommentsHubClient }

export function createCommentsRealtimeClient(): CommentsHubClient {
  return createCommentsHubClient()
}
