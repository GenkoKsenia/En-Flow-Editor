import {
  SchemeHubActionType,
} from '../api'
import type {
  DiagramDto,
  EditorBlockStyleDto,
  EditorConnectionStyleDto,
  SchemeHubCodeRequest,
  type SchemeHubBlockChange,
  type SchemeHubBlockStyleChange,
  type SchemeHubConnectionChange,
  type SchemeHubConnectionStyleChange,
  type SchemeHubDataFlowChange,
} from '../api'

type DiagramSyncDependencies = {
  serializeDiagram: () => DiagramDto
  applyParsedDiagram: (parsed: DiagramDto) => void
  syncJsonFromState: () => void
}

export function createDiagramSyncUseCases(dependencies: DiagramSyncDependencies) {
  function readCollection<T>(payload: Record<string, unknown>, pascalKey: string, camelKey: string): T[] {
    const value = payload[camelKey] ?? payload[pascalKey]
    return Array.isArray(value) ? value as T[] : []
  }

  function readObject(payload: Record<string, unknown>, pascalKey: string, camelKey: string): Record<string, unknown> | null {
    const value = payload[camelKey] ?? payload[pascalKey]
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
  }

  function resolveActionType(
    change:
      | SchemeHubBlockChange
      | SchemeHubDataFlowChange
      | SchemeHubConnectionChange
      | SchemeHubBlockStyleChange
      | SchemeHubConnectionStyleChange,
  ): SchemeHubActionType | undefined {
    const raw = change as unknown as Record<string, unknown>
    return (raw.actionType ?? raw.actiontype ?? raw.ActionType ?? raw.Actiontype) as SchemeHubActionType | undefined
  }

  function normalizeBlockChange(change: unknown): SchemeHubBlockChange | null {
    const raw = change as Record<string, unknown>
    const block = readObject(raw, 'Block', 'block')
    if (!block) return null

    return {
      actiontype: resolveActionType(raw as SchemeHubBlockChange),
      block: block as SchemeHubBlockChange['block'],
    }
  }

  function normalizeDataFlowChange(change: unknown): SchemeHubDataFlowChange | null {
    const raw = change as Record<string, unknown>
    const dataFlow = readObject(raw, 'DataFlow', 'dataFlow')
    if (!dataFlow) return null

    return {
      actionType: resolveActionType(raw as SchemeHubDataFlowChange),
      dataFlow: dataFlow as SchemeHubDataFlowChange['dataFlow'],
    }
  }

  function normalizeConnectionChange(change: unknown): SchemeHubConnectionChange | null {
    const raw = change as Record<string, unknown>
    const connection = readObject(raw, 'Connection', 'connection')
    if (!connection) return null

    return {
      actionType: resolveActionType(raw as SchemeHubConnectionChange),
      connection: connection as SchemeHubConnectionChange['connection'],
    }
  }

  function normalizeBlockStyleChange(change: unknown): SchemeHubBlockStyleChange | null {
    const raw = change as Record<string, unknown>
    const blockStyle = readObject(raw, 'BlockStyle', 'blockStyle')
    if (!blockStyle) return null

    return {
      actionType: resolveActionType(raw as SchemeHubBlockStyleChange),
      blockStyle: blockStyle as SchemeHubBlockStyleChange['blockStyle'],
    }
  }

  function normalizeConnectionStyleChange(change: unknown): SchemeHubConnectionStyleChange | null {
    const raw = change as Record<string, unknown>
    const connectionStyle = readObject(raw, 'ConnectionStyle', 'connectionStyle')
    if (!connectionStyle) return null

    return {
      actionType: resolveActionType(raw as SchemeHubConnectionStyleChange),
      connectionStyle: connectionStyle as SchemeHubConnectionStyleChange['connectionStyle'],
    }
  }

  function normalizeChanges(changes: SchemeHubCodeRequest): SchemeHubCodeRequest {
    const raw = changes as unknown as Record<string, unknown>
    const styles = readObject(raw, 'Styles', 'styles') ?? {}

    return {
      blocks: readCollection(raw, 'Blocks', 'blocks')
        .map(normalizeBlockChange)
        .filter((item): item is SchemeHubBlockChange => item !== null),
      dataFlows: readCollection(raw, 'DataFlows', 'dataFlows')
        .map(normalizeDataFlowChange)
        .filter((item): item is SchemeHubDataFlowChange => item !== null),
      connections: readCollection(raw, 'Connections', 'connections')
        .map(normalizeConnectionChange)
        .filter((item): item is SchemeHubConnectionChange => item !== null),
      styles: {
        blocks: readCollection(styles, 'Blocks', 'blocks')
          .map(normalizeBlockStyleChange)
          .filter((item): item is SchemeHubBlockStyleChange => item !== null),
        connections: readCollection(styles, 'Connections', 'connections')
          .map(normalizeConnectionStyleChange)
          .filter((item): item is SchemeHubConnectionStyleChange => item !== null),
      },
    }
  }

  function upsertById<T extends { id?: string }>(items: T[], incoming: T): T[] {
    const id = incoming.id
    if (!id) return items

    const index = items.findIndex(item => item.id === id)
    if (index === -1) {
      return [...items, incoming]
    }

    return items.map((item, itemIndex) => (itemIndex === index ? incoming : item))
  }

  function removeById<T extends { id?: string }>(items: T[], id?: string): T[] {
    if (!id) return items
    return items.filter(item => item.id !== id)
  }

  function upsertByElementId<T extends { element_id?: string }>(items: T[], incoming: T): T[] {
    const elementId = incoming.element_id
    if (!elementId) return items

    const index = items.findIndex(item => item.element_id === elementId)
    if (index === -1) {
      return [...items, incoming]
    }

    return items.map((item, itemIndex) => (itemIndex === index ? incoming : item))
  }

  function removeByElementId<T extends { element_id?: string }>(items: T[], elementId?: string): T[] {
    if (!elementId) return items
    return items.filter(item => item.element_id !== elementId)
  }

  function upsertByDataKey<T extends { dataKey?: string }>(items: T[], incoming: T): T[] {
    const dataKey = incoming.dataKey
    if (!dataKey) return items

    const index = items.findIndex(item => item.dataKey === dataKey)
    if (index === -1) {
      return [...items, incoming]
    }

    return items.map((item, itemIndex) => (itemIndex === index ? incoming : item))
  }

  function removeByDataKey<T extends { dataKey?: string }>(items: T[], dataKey?: string): T[] {
    if (!dataKey) return items
    return items.filter(item => item.dataKey !== dataKey)
  }

  function applyRemoteChanges(changes: SchemeHubCodeRequest): void {
    const normalizedChanges = normalizeChanges(changes)
    const current = dependencies.serializeDiagram()
    let nextBlocks = [...current.blocks]
    let nextConnections = [...current.connections]
    let nextDataFlows = [...current.dataFlows]
    let nextBlockStyles = [...(current.styles?.blocks ?? [])]
    let nextConnectionStyles = [...(current.styles?.connections ?? [])]

    for (const change of normalizedChanges.blocks ?? []) {
      const actionType = resolveActionType(change)
      const block = change.block
      if (!block?.id || !actionType) continue

      if (actionType === SchemeHubActionType.Delete) {
        nextBlocks = removeById(nextBlocks, block.id)
        nextBlockStyles = removeByElementId(nextBlockStyles, block.id)
        continue
      }

      nextBlocks = upsertById(nextBlocks, block)
    }

    for (const change of normalizedChanges.dataFlows ?? []) {
      const actionType = resolveActionType(change)
      const dataFlow = change.dataFlow
      if (!dataFlow?.dataKey || !actionType) continue

      if (actionType === SchemeHubActionType.Delete) {
        nextDataFlows = removeByDataKey(nextDataFlows, dataFlow.dataKey)
        continue
      }

      nextDataFlows = upsertByDataKey(nextDataFlows, dataFlow)
    }

    for (const change of normalizedChanges.connections ?? []) {
      const actionType = resolveActionType(change)
      const connection = change.connection
      if (!connection?.id || !actionType) continue

      if (actionType === SchemeHubActionType.Delete) {
        nextConnections = removeById(nextConnections, connection.id)
        nextConnectionStyles = removeByElementId(nextConnectionStyles, connection.id)
        continue
      }

      nextConnections = upsertById(nextConnections, connection)
    }

    for (const change of normalizedChanges.styles?.blocks ?? []) {
      const actionType = resolveActionType(change)
      const blockStyle = change.blockStyle as EditorBlockStyleDto | undefined
      if (!blockStyle?.element_id || !actionType) continue

      if (actionType === SchemeHubActionType.Delete) {
        nextBlockStyles = removeByElementId(nextBlockStyles, blockStyle.element_id)
        continue
      }

      nextBlockStyles = upsertByElementId(nextBlockStyles, blockStyle)
    }

    for (const change of normalizedChanges.styles?.connections ?? []) {
      const actionType = resolveActionType(change)
      const connectionStyle = change.connectionStyle as EditorConnectionStyleDto | undefined
      if (!connectionStyle?.element_id || !actionType) continue

      if (actionType === SchemeHubActionType.Delete) {
        nextConnectionStyles = removeByElementId(nextConnectionStyles, connectionStyle.element_id)
        continue
      }

      nextConnectionStyles = upsertByElementId(nextConnectionStyles, connectionStyle)
    }

    const merged: DiagramDto = {
      blocks: nextBlocks,
      dataFlows: nextDataFlows,
      connections: nextConnections,
      styles: {
        blocks: nextBlockStyles,
        connections: nextConnectionStyles,
      },
    }

    dependencies.applyParsedDiagram(merged)
    dependencies.syncJsonFromState()
  }

  return {
    applyRemoteChanges,
  }
}
