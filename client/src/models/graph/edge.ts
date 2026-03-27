import type { ConnectionSide } from './connection-side'
import type { EdgeGeometry } from './edge-geometry'
import type { EdgeMarkerType, LineStyle } from './styles'

export interface Edge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourceSide: ConnectionSide
  targetSide: ConnectionSide
  label?: string
  color?: string
  width?: number
  lineStyle?: LineStyle
  markerType?: EdgeMarkerType
  breakpointX?: number
  breakpointY?: number
  breakpointLocked?: boolean
  geometry?: EdgeGeometry
  dataKeys?: string[]
}
