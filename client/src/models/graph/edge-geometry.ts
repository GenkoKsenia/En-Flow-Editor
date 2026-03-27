import type { Segment } from './segment'

export interface EdgeGeometry {
  segments: Segment[]
  totalLength: number
  boundingBox: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    width: number
    height: number
  }
}
