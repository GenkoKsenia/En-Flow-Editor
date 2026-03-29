import type { EditorBlockDto } from './editor-block.dto'
import type { EditorCommentDto } from './editor-comment.dto'
import type { EditorConnectionDto } from './editor-connection.dto'
import type { EditorDataFlowDto } from './editor-data-flow.dto'
import type { EditorStylesDto } from './editor-styles.dto'

export interface EditorDocumentDto {
  blocks?: EditorBlockDto[]
  dataFlows?: EditorDataFlowDto[]
  connections?: EditorConnectionDto[]
  styles?: EditorStylesDto | null
  comments?: EditorCommentDto[]
}
