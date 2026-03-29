import type { Position } from '@/models/graph'

export interface EditorComment {
  id: string
  targetId: string | null
  offset: Position
  text: string
  author: string
  createdAt: string
}
