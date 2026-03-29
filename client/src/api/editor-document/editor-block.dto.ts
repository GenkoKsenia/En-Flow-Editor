import type { EditorDocumentPositionDto } from './editor-document-position.dto'

export interface EditorBlockDto {
  id: string
  name: string
  information?: unknown
  position?: EditorDocumentPositionDto
  width?: number
  height?: number
  parentId?: string | null
}
