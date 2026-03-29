import type { EditorDocumentPositionDto } from './editor-document-position.dto'

export interface EditorBlockDto {
  id: string
  name?: string
  text?: string
  type?: string | null
  position?: EditorDocumentPositionDto
  width?: number
  height?: number
  parentId?: string | null
  information?: unknown
}
