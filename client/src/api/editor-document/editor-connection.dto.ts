import type { ConnectionSide } from '@/models'
import type { EditorDocumentPositionDto } from './editor-document-position.dto'

export interface EditorConnectionDto {
  id: string
  startBlock?: string | null
  endBlock?: string | null
  startSide?: ConnectionSide | null
  endSide?: ConnectionSide | null
  label?: string | null
  dataKeys?: unknown
  through?: unknown
  breakpoints?: unknown
}

export function findFirstValidBreakpoint(
  breakpoints: unknown,
): EditorDocumentPositionDto | null {
  if (!Array.isArray(breakpoints)) return null

  return breakpoints.find((point): point is EditorDocumentPositionDto =>
    typeof point === 'object' &&
    point !== null &&
    typeof (point as EditorDocumentPositionDto).x === 'number' &&
    typeof (point as EditorDocumentPositionDto).y === 'number',
  ) ?? null
}
