import type { ConnectionSide, DataFlow, Edge, NodeLineStyle } from '@/domains/graph'

import type { EditorDataFlowDto } from '../api'

export function normalizeLineStyle(style: unknown): Edge['lineStyle'] {
  return style === 'dashed' || style === 'dotted' ? style : 'solid'
}

export function normalizeBorderStyle(style: unknown): NodeLineStyle {
  return style === 'dashed' ? 'dashed' : 'solid'
}

export function normalizeConnectionSide(side: unknown): ConnectionSide {
  return side === 'top' || side === 'right' || side === 'bottom' || side === 'left' ? side : 'right'
}

export function normalizeInformation(info: unknown): string[] {
  if (Array.isArray(info)) return info.filter((item): item is string => typeof item === 'string')
  if (typeof info === 'string') return [info]
  return []
}

export function normalizeDataFlow(flow: EditorDataFlowDto, fallbackStart?: string): DataFlow | null {
  const keyRaw = (flow as any)?.dataKey ?? (flow as any)?.id ?? (flow as any)?.key
  if (!keyRaw) return null

  const startRaw = (flow as any)?.startBlock ?? (flow as any)?.sourceBlock ?? fallbackStart ?? null
  if (!startRaw) return null

  const finishBlocks = Array.isArray((flow as any)?.finishBlocks)
    ? (flow as any).finishBlocks.map((finishBlock: unknown) => String(finishBlock)).filter(Boolean)
    : []

  const dataName = typeof (flow as any)?.dataName === 'string'
    ? (flow as any).dataName
    : (typeof (flow as any)?.name === 'string' ? (flow as any).name : String(keyRaw))

  return {
    dataKey: String(keyRaw),
    dataName,
    startBlock: String(startRaw),
    finishBlocks,
  }
}
