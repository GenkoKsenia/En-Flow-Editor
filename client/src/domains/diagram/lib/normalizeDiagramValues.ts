import type { ConnectionSide, DataFlow, Edge, NodeLineStyle } from '@/domains/graph'

import type { EditorDataFlowDto } from '../api'

const INFORMATION_TEXT_PREFIX = '__enflow_info_text__:'

export function normalizeLineStyle(style: unknown): Edge['lineStyle'] {
  return style === 'dashed' || style === 'dotted' ? style : 'solid'
}

export function normalizeBorderStyle(style: unknown): NodeLineStyle {
  return style === 'dashed' ? 'dashed' : 'solid'
}

export function normalizeConnectionSide(side: unknown): ConnectionSide {
  return side === 'top' || side === 'right' || side === 'bottom' || side === 'left' ? side : 'right'
}

function normalizeInformationText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function decodeLegacyInformationText(value: string): string {
  if (!value.includes('%')) {
    return value
  }

  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function parseInformationPayload(
  info: unknown,
  explicitText?: unknown,
): { ids: string[]; text: string } {
  const items = Array.isArray(info)
    ? info.filter((item): item is string => typeof item === 'string')
    : (typeof info === 'string' ? [info] : [])

  let text = normalizeInformationText(explicitText)
  const ids: string[] = []

  items.forEach(item => {
    if (item.startsWith(INFORMATION_TEXT_PREFIX)) {
      text = decodeLegacyInformationText(item.slice(INFORMATION_TEXT_PREFIX.length).trim())
      return
    }

    ids.push(item)
  })

  return { ids, text }
}

export function normalizeInformation(info: unknown): string[] {
  return parseInformationPayload(info).ids
}

export function buildInformationPayload(ids: string[] = [], text?: string | null): string[] {
  const normalizedIds = ids.filter(id => typeof id === 'string' && id.trim().length > 0)
  const normalizedText = normalizeInformationText(text)

  if (!normalizedText) {
    return normalizedIds
  }

  return [
    ...normalizedIds,
    `${INFORMATION_TEXT_PREFIX}${normalizedText}`,
  ]
}

export function normalizeDataFlow(flow: EditorDataFlowDto, fallbackStart?: string): DataFlow | null {
  const keyRaw = (flow as any)?.dataKey ?? (flow as any)?.id ?? (flow as any)?.key
  if (!keyRaw) return null

  const startRaw = (flow as any)?.startBlock ?? (flow as any)?.sourceBlock ?? fallbackStart ?? null

  const finishBlocks = Array.isArray((flow as any)?.finishBlocks)
    ? (flow as any).finishBlocks.map((finishBlock: unknown) => String(finishBlock)).filter(Boolean)
    : []

  const dataName = typeof (flow as any)?.dataName === 'string'
    ? (flow as any).dataName
    : (typeof (flow as any)?.name === 'string' ? (flow as any).name : String(keyRaw))

  return {
    dataKey: String(keyRaw),
    dataName,
    startBlock: startRaw ? String(startRaw) : undefined,
    finishBlocks,
  }
}
