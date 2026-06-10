import type { Position } from './position'

export interface Segment {
  id: string
  type: 'line' | 'curve'
  start: Position
  end: Position
}
