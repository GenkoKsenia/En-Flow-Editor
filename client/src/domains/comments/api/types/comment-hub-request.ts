import type { CommentDto } from './comment-dto'

export interface JoinCommentsRequest {
  schemeId: number
  versionId: number
}

export interface CommentHubRequest {
  schemeId: number
  versionId: number
  elementId: string
  elementType: string
  text: string
  x: number
  y: number
}

export interface CommentUpdateRequest {
  schemeId: number
  versionId: number
  commentId: number
  text: string
}

export interface CommentPositionUpdateRequest {
  schemeId: number
  versionId: number
  commentId: number
  x: number
  y: number
}

export interface CommentCompleteRequest {
  schemeId: number
  versionId: number
  commentId: number
}

export interface CommentDeleteRequest {
  schemeId: number
  versionId: number
  commentId: number
}

export interface CommentAfterActionResponse {
  versionId: number
  comment: CommentDto
}
