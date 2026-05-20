import type { ConnectionSide } from './connection-side'

export type LineStyle = 'solid' | 'dashed' | 'dotted'
export type NodeLineStyle = 'solid' | 'dashed' | 'database'
export type EdgeMarkerType = 'triangle' | 'none'

const DEFAULT_NODE_CONNECTION_SIDES: readonly ConnectionSide[] = ['top', 'right', 'bottom', 'left']
const DATABASE_NODE_CONNECTION_SIDES: readonly ConnectionSide[] = ['left', 'right']

export function isDatabaseBorderStyle(style: unknown): style is 'database' {
  return style === 'database'
}

export function getAllowedConnectionSidesForBorderStyle(
  borderStyle?: NodeLineStyle | string | null,
): readonly ConnectionSide[] {
  return isDatabaseBorderStyle(borderStyle)
    ? DATABASE_NODE_CONNECTION_SIDES
    : DEFAULT_NODE_CONNECTION_SIDES
}

export function isConnectionSideAllowedForBorderStyle(
  side: ConnectionSide,
  borderStyle?: NodeLineStyle | string | null,
): boolean {
  return getAllowedConnectionSidesForBorderStyle(borderStyle).includes(side)
}

export function normalizeConnectionSideForBorderStyle(
  side: ConnectionSide,
  borderStyle?: NodeLineStyle | string | null,
): ConnectionSide {
  if (!isDatabaseBorderStyle(borderStyle)) {
    return side
  }

  if (side === 'top') return 'left'
  if (side === 'bottom') return 'right'
  return side
}
