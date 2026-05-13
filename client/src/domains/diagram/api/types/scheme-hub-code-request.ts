import type { EditorBlockDto } from '../editor-block.dto'
import type { EditorConnectionStyleDto } from '../editor-connection-style.dto'
import type { EditorConnectionDto } from '../editor-connection.dto'
import type { EditorDataFlowDto } from '../editor-data-flow.dto'
import type { EditorBlockStyleDto } from '../editor-block-style.dto'

export enum SchemeHubActionType {
  Create = 1,
  Update = 2,
  Delete = 3,
}

export interface SchemeHubBlockChange {
  dateTime?: string
  actiontype?: SchemeHubActionType
  actionType?: SchemeHubActionType
  block: EditorBlockDto
}

export interface SchemeHubDataFlowChange {
  dateTime?: string
  actionType?: SchemeHubActionType
  dataFlow: EditorDataFlowDto
}

export interface SchemeHubConnectionChange {
  dateTime?: string
  actionType?: SchemeHubActionType
  connection: EditorConnectionDto
}

export interface SchemeHubBlockStyleChange {
  dateTime?: string
  actionType?: SchemeHubActionType
  blockStyle: Pick<
    EditorBlockStyleDto,
    | 'elementId'
    | 'element_id'
    | 'elementType'
    | 'element_type'
    | 'color'
    | 'borderColor'
    | 'border_color'
    | 'borderWidth'
    | 'border_width'
    | 'borderRadius'
    | 'border_radius'
    | 'borderStyle'
    | 'border_style'
  >
}

export interface SchemeHubConnectionStyleChange {
  dateTime?: string
  actionType?: SchemeHubActionType
  connectionStyle: Pick<
    EditorConnectionStyleDto,
    'elementId' | 'element_id' | 'elementType' | 'element_type' | 'color' | 'width' | 'type'
  >
}

export interface SchemeHubStylesRequest {
  blocks?: SchemeHubBlockStyleChange[]
  connections?: SchemeHubConnectionStyleChange[]
}

export interface SchemeHubCodeRequest {
  blocks?: SchemeHubBlockChange[]
  dataFlows?: SchemeHubDataFlowChange[]
  connections?: SchemeHubConnectionChange[]
  styles?: SchemeHubStylesRequest
}
