import type { DiagramPositionDto } from './diagram-position.dto'

export interface EditorBlockDto {
  id: string
  name?: string
  text?: string
  informationText?: string
  type?: string | null
  position?: DiagramPositionDto
  width?: number
  height?: number
  parentId?: string | null
  information?: unknown
}
