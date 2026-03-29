import type { EditorBlockStyleDto } from './editor-block-style.dto'
import type { EditorConnectionStyleDto } from './editor-connection-style.dto'

export interface EditorStylesDto {
  blocks?: EditorBlockStyleDto[]
  connections?: EditorConnectionStyleDto[]
}
