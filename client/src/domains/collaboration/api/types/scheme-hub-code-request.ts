import type { EditorBlockDto } from '@/domains/editor-document'
import type { EditorConnectionDto } from '@/domains/editor-document'
import type { EditorDataFlowDto } from '@/domains/editor-document'
import type { EditorStylesDto } from '@/domains/editor-document'

export interface SchemeHubCodeRequest {
  blocks?: EditorBlockDto[]
  dataFlows?: EditorDataFlowDto[]
  connections?: EditorConnectionDto[]
  styles?: EditorStylesDto
}
