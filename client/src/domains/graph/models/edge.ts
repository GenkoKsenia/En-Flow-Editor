import type { ConnectionSide } from './connection-side'
import type { EdgeGeometry } from './edge-geometry'
import type { EdgeMarkerType, LineStyle } from './styles'
import type { Position } from './position'

export interface Edge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourceSide: ConnectionSide
  targetSide: ConnectionSide
  sourceOrder?: number
  targetOrder?: number
  label?: string
  labelPosition?: number
  color?: string
  width?: number
  lineStyle?: LineStyle
  markerType?: EdgeMarkerType
  breakpoints?: Position[]
  breakpointX?: number
  breakpointY?: number
  breakpointLocked?: boolean
  geometry?: EdgeGeometry
  dataKeys?: string[]
}
