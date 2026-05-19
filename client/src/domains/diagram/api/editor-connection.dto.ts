import type { ConnectionSide } from '@/domains/graph'

import type { DiagramPositionDto } from './diagram-position.dto'

export interface EditorConnectionDto {
  id: string
  startBlock?: string | null
  endBlock?: string | null
  startSide?: ConnectionSide | null
  endSide?: ConnectionSide | null
  startOrder?: number | null
  endOrder?: number | null
  label?: string | null
  dataKeys?: unknown
  through?: unknown
  breakpoints?: unknown
}

export function findFirstValidBreakpoint(
  breakpoints: unknown,
): DiagramPositionDto | null {
  if (!Array.isArray(breakpoints)) return null

  return breakpoints.find((point): point is DiagramPositionDto =>
    typeof point === 'object' &&
    point !== null &&
    typeof (point as DiagramPositionDto).x === 'number' &&
    typeof (point as DiagramPositionDto).y === 'number',
  ) ?? null
}
