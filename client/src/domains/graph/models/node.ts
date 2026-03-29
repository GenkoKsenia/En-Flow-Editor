import type { Position } from './position'
import type { NodeLineStyle } from './styles'

export interface Node {
  id: string
  type?: string | null
  position: Position
  text: string
  width: number
  height: number
  parentId?: string
  passThroughEdges?: string[]
  color?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  borderStyle?: NodeLineStyle
  meta?: Record<string, unknown> | null
  informationIds?: string[]
}
