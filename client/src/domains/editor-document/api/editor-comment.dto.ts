import type { CommentTarget } from '../models'

import type { EditorDocumentPositionDto } from './editor-document-position.dto'

export interface EditorCommentDto {
  id?: string
  targetId?: string | null
  targetType?: CommentTarget
  offset?: Partial<EditorDocumentPositionDto>
  text?: string
  author?: string
  createdAt?: string
}
