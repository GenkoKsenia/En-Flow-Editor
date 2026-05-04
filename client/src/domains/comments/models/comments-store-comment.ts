import type { Position } from '@/domains/graph'

import type { CommentTarget } from './comment-target'

export type CommentStatus = 'draft' | 'sending' | 'synced' | 'error'

export interface CommentsStoreComment {
  id: string
  serverId?: number
  targetType: CommentTarget
  targetId: string | null
  position: Position
  text: string
  authorId?: string
  author: string
  createdAt: string
  completionDate: string | null
  status: CommentStatus
}
