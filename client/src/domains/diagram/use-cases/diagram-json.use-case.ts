import type { DataFlow, Edge, Node } from '@/domains/graph'

import {
  buildInformationPayload,
  createEmptyDiagram,
  generateEdgeLabel,
  getAbsoluteNodePosition,
  getNodeConnectionPoint,
  getOrthogonalDefaultBreakpoint,
  normalizeBorderStyle,
  normalizeConnectionSide,
  normalizeDataFlow,
  parseInformationPayload,
  normalizeLineStyle,
  normalizeNodeId,
} from '../lib'
import type {
  DiagramDto,
  DiagramPositionDto,
  EditorStylesDto,
} from '../api'
import { findFirstValidBreakpoint } from '../api'

import type { DiagramContext } from './diagram.context'

type DiagramJsonDependencies = {
  buildNodeSendableData: () => Record<string, string[]>
  refreshCounters: () => void
}

type SerializeMode = 'server' | 'editor'

export function createDiagramJsonUseCases(
  context: DiagramContext,
  dependencies: DiagramJsonDependencies,
) {
  function buildThroughMap(): Record<string, string[]> {
    return context.nodes.value.reduce<Record<string, string[]>>((acc, node) => {
      ;(node.passThroughEdges ?? []).forEach(edgeId => {
        if (!acc[edgeId]) acc[edgeId] = []
        acc[edgeId].push(node.id)
      })
      return acc
    }, {})
  }

  function buildStyles() {
    return {
      blocks: context.nodes.value.map(node => ({
        element_id: node.id,
        element_type: 'block',
        color: node.color ?? context.defaults.DEFAULT_NODE_COLOR,
        border_color: node.borderColor ?? context.defaults.DEFAULT_BORDER_COLOR,
        border_width: node.borderWidth ?? context.defaults.DEFAULT_BORDER_WIDTH,
        border_radius: node.borderRadius ?? context.defaults.DEFAULT_BORDER_RADIUS,
        border_style: node.borderStyle ?? 'solid',
      })),
      connections: context.edges.value.map(edge => ({
        element_id: edge.id,
        element_type: 'connection',
        color: edge.color ?? context.defaults.DEFAULT_EDGE_COLOR,
        width: edge.width ?? context.defaults.DEFAULT_EDGE_WIDTH,
        type: edge.lineStyle ?? 'solid',
      })),
    }
  }

  function extractBreakpoints(edge: Edge): DiagramPositionDto[] {
    if (typeof edge.breakpointX === 'number' && typeof edge.breakpointY === 'number') {
      return [{ x: edge.breakpointX, y: edge.breakpointY }]
    }

    if (typeof edge.breakpointX !== 'number' && typeof edge.breakpointY !== 'number') {
      return []
    }

    const sourceNode = context.nodes.value.find(node => node.id === edge.sourceNodeId)
    const targetNode = context.nodes.value.find(node => node.id === edge.targetNodeId)
    if (!sourceNode || !targetNode) {
      return []
    }

    const sourcePoint = getNodeConnectionPoint(
      getAbsoluteNodePosition(context.nodes.value, sourceNode),
      sourceNode,
      edge.sourceSide,
    )
    const targetPoint = getNodeConnectionPoint(
      getAbsoluteNodePosition(context.nodes.value, targetNode),
      targetNode,
      edge.targetSide,
    )
    const fallback = getOrthogonalDefaultBreakpoint(edge, sourcePoint, targetPoint)

    return [{
      x: typeof edge.breakpointX === 'number' ? edge.breakpointX : fallback.x,
      y: typeof edge.breakpointY === 'number' ? edge.breakpointY : fallback.y,
    }]
  }

  function serializeBlocks(mode: SerializeMode): DiagramDto['blocks'] {
    return context.nodes.value.map(node => ({
      id: node.id,
      name: node.text,
      information: mode === 'server'
        ? buildInformationPayload(node.informationIds ?? [], node.informationText)
        : [...(node.informationIds ?? [])],
      informationText: mode === 'editor' && node.informationText?.trim()
        ? node.informationText.trim()
        : undefined,
      position: { x: node.position.x, y: node.position.y },
      width: node.width,
      height: node.height,
      parentId: node.parentId ?? null,
    }))
  }

  function serializeDiagram(): DiagramDto {
    const throughByEdgeId = buildThroughMap()

    return {
      blocks: serializeBlocks('server'),
      dataFlows: context.dataFlows.value.map(flow => ({
        dataKey: flow.dataKey,
        dataName: flow.dataName,
        startBlock: flow.startBlock,
        finishBlocks: flow.finishBlocks ?? [],
      })),
      connections: context.edges.value.map(edge => ({
        id: edge.id,
        startBlock: edge.sourceNodeId ?? null,
        endBlock: edge.targetNodeId ?? null,
        startSide: edge.sourceSide ?? null,
        endSide: edge.targetSide ?? null,
        label: edge.label ?? null,
        dataKeys: edge.dataKeys ?? [],
        through: throughByEdgeId[edge.id] ?? [],
        breakpoints: extractBreakpoints(edge),
      })),
      styles: buildStyles(),
    }
  }

  function serializeDiagramForEditor(): DiagramDto {
    return {
      ...serializeDiagram(),
      blocks: serializeBlocks('editor'),
    }
  }

  function syncJsonFromState(): void {
    const serialized = JSON.stringify(serializeDiagramForEditor(), null, 2)
    context.lastSerializedJson.value = serialized

    if (context.isEditorFocused.value && context.jsonBuffer.value !== serialized) {
      return
    }

    context.isUpdatingFromState.value = true
    context.jsonBuffer.value = serialized
    context.isUpdatingFromState.value = false
  }

  function getNodeLabel(nodeId: string): string {
    return context.nodes.value.find(node => node.id === nodeId)?.text?.trim() || nodeId
  }

  function applyParsedDiagram(parsed: DiagramDto): void {
    const parsedBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : []
    const parsedConnections = Array.isArray(parsed.connections) ? parsed.connections : []
    const parsedStyles: EditorStylesDto | null = parsed.styles ?? null
    const parsedDataFlows = Array.isArray(parsed.dataFlows) ? parsed.dataFlows : []
    const blockStyles: Record<string, { color?: string; border_color?: string; border_width?: number; border_radius?: number; border_style?: string }> = {}
    const connectionStyles: Record<string, { color?: string; width?: number; type?: string }> = {}
    const nodeIdMap: Record<string, string> = {}

    parsedStyles?.blocks?.forEach(style => {
      if (!style?.element_id) return
      blockStyles[String(style.element_id)] = {
        color: style.color,
        border_color: style.border_color,
        border_width: typeof style.border_width === 'number' ? style.border_width : undefined,
        border_radius: typeof style.border_radius === 'number' ? style.border_radius : undefined,
        border_style: style.border_style,
      }
    })

    parsedStyles?.connections?.forEach(style => {
      if (!style?.element_id) return
      connectionStyles[String(style.element_id)] = {
        color: style.color,
        width: typeof style.width === 'number' ? style.width : undefined,
        type: style.type,
      }
    })

    const passThroughByNode: Record<string, string[]> = {}
    parsedConnections.forEach(connection => {
      const through = Array.isArray(connection?.through) ? connection.through : []
      through.forEach(blockId => {
        const nodeId = normalizeNodeId(blockId) ?? String(blockId)
        if (!passThroughByNode[nodeId]) passThroughByNode[nodeId] = []
        if (connection?.id) passThroughByNode[nodeId].push(String(connection.id))
      })
    })

    const dataFlowMap = new Map<string, DataFlow>()
    parsedDataFlows.forEach(flow => {
      const normalized = normalizeDataFlow(flow)
      if (normalized) {
        dataFlowMap.set(normalized.dataKey, normalized)
      }
    })

    const normalizedNodes = parsedBlocks
      .map(block => {
        if (!block?.id) return null
        const rawId = String(block.id)
        const normalizedId = normalizeNodeId(rawId)
        if (!normalizedId) return null

        nodeIdMap[rawId] = normalizedId
        const informationPayload = parseInformationPayload(
          (block as any).information,
          (block as any).informationText,
        )
        const information = informationPayload.ids
        const style = blockStyles[String(block.id)]

        information.forEach(infoId => {
          const existing = dataFlowMap.get(infoId)
          if (existing) {
            if (!existing.startBlock) {
              existing.startBlock = normalizedId
            }
            return
          }

          const fallback = normalizeDataFlow(
            { dataKey: infoId, dataName: infoId, startBlock: normalizedId, finishBlocks: [] },
            normalizedId,
          )
          if (fallback) dataFlowMap.set(fallback.dataKey, fallback)
        })

        return {
          id: normalizedId,
          text: block.name ?? '',
          position: {
            x: typeof block.position?.x === 'number' ? block.position.x : 0,
            y: typeof block.position?.y === 'number' ? block.position.y : 0,
          },
          width: typeof block.width === 'number' ? block.width : 120,
          height: typeof block.height === 'number' ? block.height : 60,
          parentId: block.parentId ? (nodeIdMap[String(block.parentId)] ?? normalizeNodeId(block.parentId)) ?? undefined : undefined,
          passThroughEdges: passThroughByNode[normalizedId] ?? [],
          color: style?.color ?? context.defaults.DEFAULT_NODE_COLOR,
          borderColor: style?.border_color ?? context.defaults.DEFAULT_BORDER_COLOR,
          borderWidth: style?.border_width ?? context.defaults.DEFAULT_BORDER_WIDTH,
          borderRadius: style?.border_radius ?? context.defaults.DEFAULT_BORDER_RADIUS,
          borderStyle: normalizeBorderStyle(style?.border_style),
          informationIds: information,
          informationText: informationPayload.text,
        } satisfies Node
      })
      .filter(Boolean) as Node[]

    const existingEdgeLabels: string[] = []
    const normalizedEdges = parsedConnections
      .map(connection => {
        if (!connection?.id || !connection?.startBlock || !connection?.endBlock) return null

        const startId = nodeIdMap[String(connection.startBlock)] ?? normalizeNodeId(connection.startBlock)
        const endId = nodeIdMap[String(connection.endBlock)] ?? normalizeNodeId(connection.endBlock)
        if (!startId || !endId) return null

        const style = connectionStyles[String(connection.id)]
        const breakpoint = findFirstValidBreakpoint(connection.breakpoints)
        const labelRaw = (connection.label ?? '').trim()
        const label = labelRaw || generateEdgeLabel(startId, endId, existingEdgeLabels, getNodeLabel)
        existingEdgeLabels.push(label)

        return {
          id: String(connection.id),
          sourceNodeId: startId,
          targetNodeId: endId,
          sourceSide: normalizeConnectionSide(connection.startSide),
          targetSide: normalizeConnectionSide(connection.endSide),
          label,
          color: style?.color ?? context.defaults.DEFAULT_EDGE_COLOR,
          width: style?.width ?? context.defaults.DEFAULT_EDGE_WIDTH,
          lineStyle: normalizeLineStyle(style?.type),
          markerType: 'triangle',
          breakpointX: breakpoint?.x,
          breakpointY: breakpoint?.y,
          breakpointLocked: false,
          geometry: undefined,
          dataKeys: Array.isArray(connection.dataKeys) ? connection.dataKeys.map(key => String(key)) : [],
        } satisfies Edge
      })
      .filter(Boolean) as Edge[]

    const normalizedDataFlows = Array.from(dataFlowMap.values()).map(flow => {
      const start = nodeIdMap[String(flow.startBlock)] ?? normalizeNodeId(flow.startBlock)
      const finish = Array.isArray(flow.finishBlocks)
        ? flow.finishBlocks.map(id => nodeIdMap[String(id)] ?? normalizeNodeId(id)).filter(Boolean) as string[]
        : []

      return {
        ...flow,
        startBlock: start ?? flow.startBlock,
        finishBlocks: finish,
      }
    })

    context.nodes.value = normalizedNodes
    context.dataFlows.value = normalizedDataFlows
    context.edges.value = normalizedEdges.map(edge => {
      const allowed = dependencies.buildNodeSendableData()[edge.sourceNodeId] ?? []
      const preferred = edge.dataKeys ?? allowed
      const sanitized = Array.from(new Set(preferred.filter(id => allowed.includes(id))))
      return { ...edge, dataKeys: sanitized }
    })
    dependencies.refreshCounters()
    context.lastSerializedJson.value = JSON.stringify(serializeDiagramForEditor(), null, 2)
  }

  function applyJson(raw: string): void {
    context.jsonError.value = null
    try {
      const parsed = JSON.parse(raw) as DiagramDto
      applyParsedDiagram(parsed)
    } catch (error) {
      context.jsonError.value = error instanceof Error ? error.message : 'Не удалось разобрать JSON'
    }
  }

  function setDiagramFromServer(code: unknown): void {
    const raw = typeof code === 'string' ? code : JSON.stringify(code ?? {}, null, 2)
    applyJson(raw)
    syncJsonFromState()
  }

  function resetDiagram(): void {
    const defaults = createEmptyDiagram()
    context.currentVersionId.value = null
    context.nodes.value = defaults.nodes
    context.edges.value = defaults.edges
    context.dataFlows.value = defaults.dataFlows
    context.jsonError.value = null
    dependencies.refreshCounters()
    syncJsonFromState()
  }

  function debounceApplyFromEditor(): void {
    if (context.applyTimeout.value) {
      clearTimeout(context.applyTimeout.value)
    }

    context.applyTimeout.value = window.setTimeout(() => {
      context.applyTimeout.value = null
      applyJson(context.jsonBuffer.value)
    }, 400)
  }

  return {
    serializeDiagram,
    serializeDiagramForEditor,
    syncJsonFromState,
    applyParsedDiagram,
    applyJson,
    setDiagramFromServer,
    resetDiagram,
    debounceApplyFromEditor,
  }
}
