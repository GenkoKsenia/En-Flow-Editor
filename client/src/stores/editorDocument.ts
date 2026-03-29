import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import * as DEFAULTS from '@/constants'
import { getSchemeById } from '@/api/schemes'
import { updateVersion } from '@/api/versions'
import type {
  ConnectionSide,
  DataFlow,
  Edge,
  Node,
  NodeLineStyle,
  Position,
} from '@/models'
import type { SchemeHubCodeRequest } from '@/api/realtime'
import {
  findPotentialParentByCenter,
  getAbsoluteNodePosition as resolveAbsoluteNodePosition,
  getDescendantNodes as resolveDescendantNodes,
  getPotentialParentCandidates,
  getRelativePositionWithinParent,
  getRequiredParentSize,
  getRootNodePosition,
  getParentChildCountMap,
  resolveNodeBorderStyle,
  roundCoord,
  toAbsoluteNodeRect,
} from '@/lib/editor/layout'
import {
  calculatePassThroughOffsets as calculatePassThroughOffsetsLayout,
  getPassThroughFraction as resolvePassThroughFraction,
  isHorizontalPassThroughEdge,
  isVerticalPassThroughEdge,
} from '@/lib/editor/graph'

type CommentTarget = 'node' | 'edge' | 'canvas'

export interface EditorComment {
  id: string
  targetId: string | null
  offset: Position
  text: string
  author: string
  createdAt: string
}

type SchemaPosition = { x: number; y: number }
type SchemaBlock = {
  id: string
  name: string
  information?: unknown
  position?: SchemaPosition
  width?: number
  height?: number
  parentId?: string | null
}
type SchemaConnection = {
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
type SchemaDataFlow = {
  dataKey?: unknown
  dataName?: unknown
  startBlock?: unknown
  finishBlocks?: unknown
}
type SchemaComment = {
  id?: string
  targetId?: string | null
  targetType?: CommentTarget
  offset?: { x?: number; y?: number }
  text?: string
  author?: string
  createdAt?: string
}
type SchemaStyles = {
  blocks?: Array<{
    element_id?: string
    color?: string
    border_color?: string
    border_width?: number
    border_radius?: number
    border_style?: string
  }>
  connections?: Array<{
    element_id?: string
    color?: string
    width?: number
    type?: string
  }>
} | null

type ParsedDocument = {
  blocks?: SchemaBlock[]
  dataFlows?: SchemaDataFlow[]
  connections?: SchemaConnection[]
  styles?: SchemaStyles
  comments?: SchemaComment[]
}

function createDefaultNode(id: string, x: number, y: number, text: string, width: number, height: number): Node {
  return {
    id,
    position: { x, y },
    text,
    width,
    height,
    passThroughEdges: [],
    color: DEFAULTS.DEFAULT_NODE_COLOR,
    borderColor: DEFAULTS.DEFAULT_BORDER_COLOR,
    borderWidth: DEFAULTS.DEFAULT_BORDER_WIDTH,
    borderRadius: DEFAULTS.DEFAULT_BORDER_RADIUS,
    borderStyle: 'solid',
  }
}

function createDefaultDocument() {
  const nodes: Node[] = [
    createDefaultNode('node-1', 50, 50, 'Начальный узел', 150, 60),
    createDefaultNode('node-2', 300, 150, 'Процесс', 120, 60),
  ]

  const edges: Edge[] = [
    {
      id: 'e1',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
      sourceSide: 'right',
      targetSide: 'left',
      color: DEFAULTS.DEFAULT_EDGE_COLOR,
      width: DEFAULTS.DEFAULT_EDGE_WIDTH,
      lineStyle: 'solid',
      markerType: 'triangle',
    },
  ]

  return {
    nodes,
    edges,
    dataFlows: [] as DataFlow[],
    comments: [] as EditorComment[],
  }
}

function normalizeNodeId(id: unknown): string | null {
  if (id === null || id === undefined) return null
  const str = String(id)
  return str.startsWith('node-') || str.startsWith('boundary-') ? str : `node-${str}`
}

function encodeTargetId(type: CommentTarget, id: string | null): string {
  if (type === 'canvas') return 'canvas'
  return `${type}:${id ?? ''}`
}

function decodeTargetId(
  raw: string | null | undefined,
  fallbackType?: CommentTarget,
  fallbackId?: string | null,
): { type: CommentTarget; id: string | null; normalized: string } {
  if (typeof raw === 'string') {
    if (raw === 'canvas') return { type: 'canvas', id: null, normalized: 'canvas' }
    if (raw.startsWith('node:')) {
      const id = raw.slice('node:'.length) || null
      return { type: 'node', id, normalized: encodeTargetId('node', id) }
    }
    if (raw.startsWith('edge:')) {
      const id = raw.slice('edge:'.length) || null
      return { type: 'edge', id, normalized: encodeTargetId('edge', id) }
    }

    return { type: 'node', id: raw || null, normalized: encodeTargetId('node', raw || null) }
  }

  if (fallbackType) {
    const encoded = encodeTargetId(fallbackType, fallbackId ?? null)
    return { type: fallbackType, id: fallbackId ?? null, normalized: encoded }
  }

  return { type: 'canvas', id: null, normalized: 'canvas' }
}

function normalizeLineStyle(style: unknown): Edge['lineStyle'] {
  return style === 'dashed' || style === 'dotted' ? style : 'solid'
}

function normalizeBorderStyle(style: unknown): NodeLineStyle {
  return style === 'dashed' ? 'dashed' : 'solid'
}

function normalizeConnectionSide(side: unknown): ConnectionSide {
  return side === 'top' || side === 'right' || side === 'bottom' || side === 'left' ? side : 'right'
}

function normalizeInformation(info: unknown): string[] {
  if (Array.isArray(info)) return info.filter((item): item is string => typeof item === 'string')
  if (typeof info === 'string') return [info]
  return []
}

function normalizeDataFlow(flow: SchemaDataFlow, fallbackStart?: string): DataFlow | null {
  const keyRaw = (flow as any)?.dataKey ?? (flow as any)?.id ?? (flow as any)?.key
  if (!keyRaw) return null

  const startRaw = (flow as any)?.startBlock ?? (flow as any)?.sourceBlock ?? fallbackStart ?? null
  if (!startRaw) return null

  const finish = Array.isArray((flow as any)?.finishBlocks)
    ? (flow as any).finishBlocks.map((f: unknown) => String(f)).filter(Boolean)
    : []

  const name = typeof (flow as any)?.dataName === 'string'
    ? (flow as any).dataName
    : (typeof (flow as any)?.name === 'string' ? (flow as any).name : String(keyRaw))

  return {
    dataKey: String(keyRaw),
    dataName: name,
    startBlock: String(startRaw),
    finishBlocks: finish,
  }
}

function getDefaultAuthor(): string {
  return 'User'
}

export const useEditorDocumentStore = defineStore('editorDocument', () => {
  const defaultDocument = createDefaultDocument()

  const schemeId = ref<string | null>(null)
  const currentVersionId = ref<string | null>(null)
  const nodes = ref<Node[]>(defaultDocument.nodes)
  const edges = ref<Edge[]>(defaultDocument.edges)
  const dataFlows = ref<DataFlow[]>(defaultDocument.dataFlows)
  const comments = ref<EditorComment[]>(defaultDocument.comments)
  const nextNodeId = ref(3)
  const nextEdgeId = ref(2)
  const nextBoundaryId = ref(1)
  const nextCommentId = ref(1)
  const jsonError = ref<string | null>(null)
  const jsonBuffer = ref('')
  const isUpdatingFromState = ref(false)
  const isEditorFocused = ref(false)
  const lastSerializedJson = ref('')
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  const isDirty = computed(() => jsonBuffer.value !== lastSerializedJson.value)

  let applyTimeout: number | null = null

  function buildThroughMap(): Record<string, string[]> {
    return nodes.value.reduce<Record<string, string[]>>((acc, node) => {
      ;(node.passThroughEdges ?? []).forEach(edgeId => {
        if (!acc[edgeId]) acc[edgeId] = []
        acc[edgeId].push(node.id)
      })
      return acc
    }, {})
  }

  function buildStyles() {
    return {
      blocks: nodes.value.map(node => ({
        element_id: node.id,
        element_type: 'block',
        color: node.color ?? DEFAULTS.DEFAULT_NODE_COLOR,
        border_color: node.borderColor ?? DEFAULTS.DEFAULT_BORDER_COLOR,
        border_width: node.borderWidth ?? DEFAULTS.DEFAULT_BORDER_WIDTH,
        border_radius: node.borderRadius ?? DEFAULTS.DEFAULT_BORDER_RADIUS,
        border_style: node.borderStyle ?? 'solid',
      })),
      connections: edges.value.map(edge => ({
        element_id: edge.id,
        element_type: 'connection',
        color: edge.color ?? DEFAULTS.DEFAULT_EDGE_COLOR,
        width: edge.width ?? DEFAULTS.DEFAULT_EDGE_WIDTH,
        type: edge.lineStyle ?? 'solid',
      })),
    }
  }

  function extractBreakpoints(edge: Edge): SchemaPosition[] {
    if (typeof edge.breakpointX === 'number' && typeof edge.breakpointY === 'number') {
      return [{ x: edge.breakpointX, y: edge.breakpointY }]
    }

    return []
  }

  function serializeDocument() {
    const throughByEdgeId = buildThroughMap()

    return {
      blocks: nodes.value.map(node => ({
        id: node.id,
        name: node.text,
        information: node.informationIds ?? [],
        position: { x: node.position.x, y: node.position.y },
        width: node.width,
        height: node.height,
        parentId: node.parentId ?? null,
      })),
      dataFlows: dataFlows.value.map(flow => ({
        dataKey: flow.dataKey,
        dataName: flow.dataName,
        startBlock: flow.startBlock,
        finishBlocks: flow.finishBlocks ?? [],
      })),
      connections: edges.value.map(edge => ({
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
      comments: comments.value.map(comment => ({
        id: comment.id,
        targetId: comment.targetId ?? 'canvas',
        offset: { x: comment.offset.x, y: comment.offset.y },
        text: comment.text,
        author: comment.author,
        createdAt: comment.createdAt,
      })),
    }
  }

  function syncJsonFromState(): void {
    const serialized = JSON.stringify(serializeDocument(), null, 2)
    lastSerializedJson.value = serialized

    if (isEditorFocused.value && jsonBuffer.value !== serialized) {
      return
    }

    isUpdatingFromState.value = true
    jsonBuffer.value = serialized
    isUpdatingFromState.value = false
  }

  function debounceApplyFromEditor(): void {
    if (applyTimeout) {
      clearTimeout(applyTimeout)
    }

    applyTimeout = window.setTimeout(() => {
      applyTimeout = null
      applyJson(jsonBuffer.value)
    }, 400)
  }

  function refreshCounters(): void {
    let maxNode = 0
    let maxBoundary = 0
    let maxEdge = 0
    let maxComment = 0

    nodes.value.forEach(node => {
      const [prefix, rawNumber] = node.id.split('-')
      const number = Number(rawNumber)
      if (!Number.isFinite(number)) return
      if (prefix === 'node') maxNode = Math.max(maxNode, number)
      if (prefix === 'boundary') maxBoundary = Math.max(maxBoundary, number)
    })

    edges.value.forEach(edge => {
      const match = edge.id.match(/(\d+)$/)
      const number = match ? Number(match[1]) : Number.NaN
      if (Number.isFinite(number)) {
        maxEdge = Math.max(maxEdge, number)
      }
    })

    comments.value.forEach(comment => {
      const match = comment.id.match(/(\d+)$/)
      const number = match ? Number(match[1]) : Number.NaN
      if (Number.isFinite(number)) {
        maxComment = Math.max(maxComment, number)
      }
    })

    nextNodeId.value = maxNode + 1
    nextBoundaryId.value = maxBoundary + 1
    nextEdgeId.value = maxEdge + 1
    nextCommentId.value = maxComment + 1
  }

  function buildNodeSendableData(): Record<string, string[]> {
    const targets: Record<string, string[]> = {}
    dataFlows.value.forEach(flow => {
      targets[flow.dataKey] = (flow.finishBlocks ?? []).map(dest => String(dest)).filter(Boolean)
    })

    const sets: Record<string, Set<string>> = {}
    nodes.value.forEach(node => {
      const own = new Set<string>()
      ;(node.informationIds ?? []).forEach(id => own.add(id))
      dataFlows.value.forEach(flow => {
        if (flow.startBlock === node.id) {
          own.add(flow.dataKey)
        }
      })
      sets[node.id] = own
    })

    let changed = true
    let iterations = 0
    while (changed && iterations < 200) {
      changed = false
      iterations += 1

      edges.value.forEach(edge => {
        const payload = (edge.dataKeys ?? []).filter(key => !(targets[key] ?? []).includes(edge.sourceNodeId))
        const sourceSet = sets[edge.sourceNodeId]
        const targetSet = sets[edge.targetNodeId]
        if (!sourceSet || !targetSet) return

        payload.forEach(key => {
          if (!sourceSet.has(key)) return
          if ((targets[key] ?? []).includes(edge.targetNodeId)) return
          if (!targetSet.has(key)) {
            targetSet.add(key)
            changed = true
          }
        })
      })
    }

    Object.entries(sets).forEach(([nodeId, set]) => {
      Array.from(set).forEach(key => {
        if ((targets[key] ?? []).includes(nodeId)) {
          set.delete(key)
        }
      })
    })

    return Object.fromEntries(Object.entries(sets).map(([id, set]) => [id, Array.from(set)]))
  }

  function ensureFlowsForInformation(nodeId: string, infoIds: string[]): void {
    const map = new Map<string, DataFlow>()
    dataFlows.value.forEach(flow => map.set(flow.dataKey, { ...flow }))
    let changed = false

    infoIds.forEach(infoId => {
      const existing = map.get(infoId)
      if (existing) {
        if (!existing.startBlock) {
          existing.startBlock = nodeId
          changed = true
        }
        return
      }

      map.set(infoId, {
        dataKey: infoId,
        dataName: infoId,
        startBlock: nodeId,
        finishBlocks: [],
      })
      changed = true
    })

    if (changed) {
      dataFlows.value = Array.from(map.values())
    }
  }

  function getNodeLabel(nodeId: string): string {
    return nodes.value.find(node => node.id === nodeId)?.text?.trim() || nodeId
  }

  function generateEdgeLabel(sourceId: string | null | undefined, targetId: string | null | undefined, existing: string[]): string {
    const source = sourceId ? getNodeLabel(String(sourceId)) : 'Источник'
    const target = targetId ? getNodeLabel(String(targetId)) : 'Цель'
    const base = `${source} → ${target}`
    if (!existing.includes(base)) return base

    let index = 2
    let candidate = `${base} (${index})`
    while (existing.includes(candidate)) {
      index += 1
      candidate = `${base} (${index})`
    }

    return candidate
  }

  function applyParsedDiagram(parsed: ParsedDocument): void {
    const parsedBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : []
    const parsedConnections = Array.isArray(parsed.connections) ? parsed.connections : []
    const parsedStyles: SchemaStyles = parsed.styles ?? null
    const parsedDataFlows = Array.isArray(parsed.dataFlows) ? parsed.dataFlows : []
    const parsedComments = Array.isArray(parsed.comments) ? parsed.comments : []
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
        const information = normalizeInformation((block as any).information)
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
          color: style?.color ?? DEFAULTS.DEFAULT_NODE_COLOR,
          borderColor: style?.border_color ?? DEFAULTS.DEFAULT_BORDER_COLOR,
          borderWidth: style?.border_width ?? DEFAULTS.DEFAULT_BORDER_WIDTH,
          borderRadius: style?.border_radius ?? DEFAULTS.DEFAULT_BORDER_RADIUS,
          borderStyle: normalizeBorderStyle(style?.border_style),
          informationIds: information,
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
        const breakpoint = Array.isArray(connection.breakpoints)
          ? (connection.breakpoints as SchemaPosition[]).find(point => typeof point?.x === 'number' && typeof point?.y === 'number')
          : null
        const labelRaw = (connection.label ?? '').trim()
        const label = labelRaw || generateEdgeLabel(startId, endId, existingEdgeLabels)
        existingEdgeLabels.push(label)

        return {
          id: String(connection.id),
          sourceNodeId: startId,
          targetNodeId: endId,
          sourceSide: normalizeConnectionSide(connection.startSide),
          targetSide: normalizeConnectionSide(connection.endSide),
          label,
          color: style?.color ?? DEFAULTS.DEFAULT_EDGE_COLOR,
          width: style?.width ?? DEFAULTS.DEFAULT_EDGE_WIDTH,
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

    nodes.value = normalizedNodes
    dataFlows.value = normalizedDataFlows
    edges.value = normalizedEdges.map(edge => {
      const allowed = buildNodeSendableData()[edge.sourceNodeId] ?? []
      const preferred = edge.dataKeys ?? allowed
      const sanitized = Array.from(new Set(preferred.filter(id => allowed.includes(id))))
      return { ...edge, dataKeys: sanitized }
    })
    comments.value = parsedComments.map((comment, index) => {
      const fallbackId = typeof comment.targetId === 'string'
        ? comment.targetId
        : (comment.targetId != null ? String(comment.targetId) : null)
      const target = decodeTargetId(
        typeof comment.targetId === 'string' ? comment.targetId : null,
        comment.targetType,
        fallbackId,
      )
      const mappedTargetId = target.type === 'node'
        ? (nodeIdMap[String(target.id)] ?? normalizeNodeId(target.id))
        : target.id

      return {
        id: comment.id ?? `comment-${index + 1}`,
        targetId: encodeTargetId(target.type, mappedTargetId),
        offset: {
          x: typeof comment.offset?.x === 'number' ? comment.offset.x : 0,
          y: typeof comment.offset?.y === 'number' ? comment.offset.y : 0,
        },
        text: typeof comment.text === 'string' ? comment.text : '',
        author: typeof comment.author === 'string' ? comment.author : getDefaultAuthor(),
        createdAt: typeof comment.createdAt === 'string' ? comment.createdAt : new Date().toLocaleString('ru-RU'),
      }
    })

    refreshCounters()
    lastSerializedJson.value = JSON.stringify(serializeDocument(), null, 2)
  }

  function applyJson(raw: string): void {
    jsonError.value = null
    try {
      const parsed = JSON.parse(raw) as ParsedDocument
      applyParsedDiagram(parsed)
    } catch (error) {
      jsonError.value = error instanceof Error ? error.message : 'Не удалось разобрать JSON'
    }
  }

  function setDocumentFromServer(code: unknown): void {
    const raw = typeof code === 'string' ? code : JSON.stringify(code ?? {}, null, 2)
    applyJson(raw)
    syncJsonFromState()
  }

  function resetDocument(): void {
    const defaults = createDefaultDocument()
    currentVersionId.value = null
    nodes.value = defaults.nodes
    edges.value = defaults.edges
    dataFlows.value = defaults.dataFlows
    comments.value = defaults.comments
    jsonError.value = null
    refreshCounters()
    syncJsonFromState()
  }

  async function loadSchemeSnapshot(nextSchemeId?: string | null): Promise<void> {
    schemeId.value = nextSchemeId ?? null
    if (!nextSchemeId) {
      resetDocument()
      return
    }

    isLoading.value = true
    loadError.value = null

    try {
      const scheme = await getSchemeById(nextSchemeId)
      const latestVersion = scheme.versions[0]
      currentVersionId.value = latestVersion?.id ?? null

      if (latestVersion) {
        setDocumentFromServer(latestVersion.code)
      } else {
        resetDocument()
      }
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Не удалось загрузить схему'
      resetDocument()
    } finally {
      isLoading.value = false
    }
  }

  async function saveCurrentVersion(): Promise<void> {
    if (!currentVersionId.value) {
      await loadSchemeSnapshot(schemeId.value)
    }

    if (!currentVersionId.value) return

    const payload = typeof jsonBuffer.value === 'string'
      ? JSON.parse(jsonBuffer.value)
      : JSON.parse(JSON.stringify(jsonBuffer.value))

    await updateVersion(currentVersionId.value, payload)
  }

  function applyRemoteChanges(changes: SchemeHubCodeRequest): void {
    const current = serializeDocument()
    const nextStyles = (changes.styles ?? {}) as NonNullable<SchemaStyles>
    const merged: ParsedDocument = {
      blocks: Array.isArray(changes.blocks) ? changes.blocks as SchemaBlock[] : current.blocks,
      dataFlows: Array.isArray(changes.dataFlows) ? changes.dataFlows as SchemaDataFlow[] : current.dataFlows,
      connections: Array.isArray(changes.connections) ? changes.connections as SchemaConnection[] : current.connections,
      comments: current.comments,
      styles: {
        ...(current.styles ?? {}),
        ...nextStyles,
      } as SchemaStyles,
    }

    applyParsedDiagram(merged)
    syncJsonFromState()
  }

  function addNode(): void {
    nodes.value.push({
      id: `node-${nextNodeId.value++}`,
      position: { x: 100, y: 100 + nodes.value.length * 80 },
      text: `Узел ${nodes.value.length + 1}`,
      width: 120,
      height: 60,
      passThroughEdges: [],
      borderStyle: 'solid',
      color: DEFAULTS.DEFAULT_NODE_COLOR,
      borderColor: DEFAULTS.DEFAULT_BORDER_COLOR,
      borderWidth: DEFAULTS.DEFAULT_BORDER_WIDTH,
      borderRadius: DEFAULTS.DEFAULT_BORDER_RADIUS,
    })
  }

  function getNextBoundaryIndex(): number {
    const prefix = 'Область '
    const indices = nodes.value
      .map(node => (node.text?.startsWith(prefix) ? Number(node.text.slice(prefix.length)) : Number.NaN))
      .filter((value): value is number => Number.isFinite(value))
    return indices.length ? Math.max(...indices) + 1 : 1
  }

  function addBoundary(): void {
    const index = getNextBoundaryIndex()
    nodes.value.push({
      id: `boundary-${nextBoundaryId.value++}`,
      position: { x: 80, y: 80 + nodes.value.length * 60 },
      text: `Область ${index}`,
      width: 180,
      height: 150,
      passThroughEdges: [],
      color: DEFAULTS.DEFAULT_NODE_COLOR,
      borderColor: DEFAULTS.DEFAULT_BORDER_COLOR,
      borderWidth: DEFAULTS.DEFAULT_BORDER_WIDTH,
      borderRadius: DEFAULTS.DEFAULT_BORDER_RADIUS,
      borderStyle: 'dashed',
    })
  }

  function addEdge(edge: Edge): void {
    edges.value.push(edge)
    const match = edge.id.match(/(\d+)$/)
    const number = match ? Number(match[1]) : Number.NaN
    if (Number.isFinite(number)) {
      nextEdgeId.value = Math.max(nextEdgeId.value, number + 1)
    }
  }

  function createEdgeId(): string {
    return `edge-${nextEdgeId.value++}`
  }

  function createCommentId(): string {
    return `comment-${nextCommentId.value++}`
  }

  function setEditorFocused(value: boolean): void {
    isEditorFocused.value = value
    if (!value) {
      syncJsonFromState()
    }
  }

  function setJsonBuffer(value: string): void {
    jsonBuffer.value = value
  }

  function updateNode(nodeId: string, updates: Partial<Node>): void {
    const node = nodes.value.find(item => item.id === nodeId)
    if (!node) return

    if (updates.informationIds) {
      ensureFlowsForInformation(nodeId, updates.informationIds)
    }

    Object.assign(node, updates)
  }

  function updateEdge(edgeId: string, updates: Partial<Edge>): void {
    const edge = edges.value.find(item => item.id === edgeId)
    if (!edge) return

    if (updates.dataKeys) {
      const allowed = buildNodeSendableData()[edge.sourceNodeId] ?? []
      updates = {
        ...updates,
        dataKeys: Array.from(new Set(updates.dataKeys.filter(id => allowed.includes(id)))),
      }
    }

    Object.assign(edge, updates)
  }

  function updateDataFlows(newFlows: DataFlow[]): void {
    dataFlows.value = newFlows
    const infoByNode: Record<string, string[]> = {}
    newFlows.forEach(flow => {
      if (!flow.startBlock) return
      if (!infoByNode[flow.startBlock]) infoByNode[flow.startBlock] = []
      infoByNode[flow.startBlock].push(flow.dataKey)
    })
    nodes.value.forEach(node => {
      node.informationIds = infoByNode[node.id] ?? []
    })
  }

  function getAbsoluteNodePosition(node: Node): Position {
    return resolveAbsoluteNodePosition(nodes.value, node)
  }

  function getDescendantNodes(nodeId: string): Node[] {
    return resolveDescendantNodes(nodes.value, nodeId)
  }

  function getNodeRect(node: Node) {
    return toAbsoluteNodeRect(getAbsoluteNodePosition(node), node)
  }

  function getPassThroughFraction(nodeId: string, edgeId: string, orientation: 'horizontal' | 'vertical'): number {
    const layout = calculatePassThroughOffsetsLayout(nodes.value, edges.value)
    return resolvePassThroughFraction(layout, nodeId, edgeId, orientation)
  }

  function alignEdgeToNode(edge: Edge, node: Node): void {
    const rect = getNodeRect(node)
    if (isHorizontalPassThroughEdge(edge)) {
      edge.breakpointX = roundCoord(rect.left + rect.width * getPassThroughFraction(node.id, edge.id, 'horizontal'))
      return
    }

    if (isVerticalPassThroughEdge(edge)) {
      edge.breakpointY = roundCoord(rect.top + rect.height * getPassThroughFraction(node.id, edge.id, 'vertical'))
    }
  }

  function maintainPassThroughEdges(nodeId: string | null | undefined): void {
    if (!nodeId) return
    const node = nodes.value.find(item => item.id === nodeId)
    if (!node || !node.passThroughEdges?.length) return

    node.passThroughEdges.forEach(edgeId => {
      const edge = edges.value.find(item => item.id === edgeId)
      if (!edge || edge.breakpointLocked) return
      alignEdgeToNode(edge, node)
    })
  }

  function refreshParentBorders(): void {
    const childCount = getParentChildCountMap(nodes.value)
    nodes.value.forEach(node => {
      node.borderStyle = resolveNodeBorderStyle(node, childCount[node.id] || 0)
    })
  }

  function ensureParentPadding(parentId: string | null | undefined, padding = 24): void {
    if (!parentId) return
    const parent = nodes.value.find(item => item.id === parentId)
    if (!parent) return

    const children = nodes.value.filter(item => item.parentId === parentId)
    if (!children.length) return

    const requiredSize = getRequiredParentSize(parent, children, padding)
    parent.width = requiredSize.width
    parent.height = requiredSize.height
    maintainPassThroughEdges(parentId)
    ensureParentPadding(parent.parentId, padding)
  }

  function findPotentialParentId(
    draggedNodeId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): string | null {
    const allChildren = getDescendantNodes(draggedNodeId)
    const excludedIds = new Set(allChildren.map(child => child.id))
    excludedIds.add(draggedNodeId)

    return findPotentialParentByCenter(
      getPotentialParentCandidates(nodes.value),
      excludedIds,
      { x, y, width, height },
    )
  }

  function moveNodeToParent(
    nodeId: string,
    parentId: string | null,
    absoluteX?: number,
    absoluteY?: number,
    padding = 24,
  ): void {
    const node = nodes.value.find(item => item.id === nodeId)
    if (!node) return

    const currentAbsolutePos = absoluteX !== undefined && absoluteY !== undefined
      ? { x: absoluteX, y: absoluteY }
      : getAbsoluteNodePosition(node)

    if (parentId) {
      const parent = nodes.value.find(item => item.id === parentId)
      if (parent) {
        const parentAbsolutePos = getAbsoluteNodePosition(parent)
        const relativePos = getRelativePositionWithinParent(currentAbsolutePos, parentAbsolutePos, padding)
        node.position.x = relativePos.x
        node.position.y = relativePos.y
        node.parentId = parentId
        ensureParentPadding(parentId, padding)
      }
    } else {
      const rootPosition = getRootNodePosition(currentAbsolutePos)
      node.position.x = rootPosition.x
      node.position.y = rootPosition.y
      node.parentId = undefined
    }

    maintainPassThroughEdges(nodeId)
    refreshParentBorders()
  }

  function finalizeNodeDrag(
    nodeId: string,
    potentialParentId: string | null,
    newAbsoluteX: number,
    newAbsoluteY: number,
    padding = 24,
  ): void {
    const node = nodes.value.find(item => item.id === nodeId)
    if (!node) return

    if (potentialParentId && potentialParentId !== node.parentId) {
      moveNodeToParent(nodeId, potentialParentId, newAbsoluteX, newAbsoluteY, padding)
      return
    }

    if (!potentialParentId && node.parentId) {
      moveNodeToParent(nodeId, null, newAbsoluteX, newAbsoluteY, padding)
      getDescendantNodes(nodeId).forEach(child => {
        const childAbsolutePos = getAbsoluteNodePosition(child)
        moveNodeToParent(child.id, null, roundCoord(childAbsolutePos.x), roundCoord(childAbsolutePos.y), padding)
      })
      return
    }

    if (node.parentId) {
      const parent = nodes.value.find(item => item.id === node.parentId)
      if (parent) {
        const parentAbsolute = getAbsoluteNodePosition(parent)
        const relativePos = getRelativePositionWithinParent(
          { x: newAbsoluteX, y: newAbsoluteY },
          parentAbsolute,
          padding,
        )
        node.position.x = relativePos.x
        node.position.y = relativePos.y
        ensureParentPadding(parent.id, padding)
      }
    } else {
      const rootPosition = getRootNodePosition({ x: newAbsoluteX, y: newAbsoluteY })
      node.position.x = rootPosition.x
      node.position.y = rootPosition.y
    }

    maintainPassThroughEdges(nodeId)
    refreshParentBorders()
  }

  function deleteNode(nodeId: string): void {
    nodes.value = nodes.value.filter(node => node.id !== nodeId)
    edges.value = edges.value.filter(edge => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId)
    comments.value = comments.value.filter(comment => comment.targetId !== encodeTargetId('node', nodeId))
  }

  function deleteEdge(edgeId: string): void {
    edges.value = edges.value.filter(edge => edge.id !== edgeId)
    comments.value = comments.value.filter(comment => comment.targetId !== encodeTargetId('edge', edgeId))
  }

  function addComment(comment: EditorComment): void {
    comments.value.push(comment)
  }

  function updateComment(commentId: string, updates: Partial<EditorComment>): void {
    const comment = comments.value.find(item => item.id === commentId)
    if (comment) {
      Object.assign(comment, updates)
    }
  }

  function removeComment(commentId: string): void {
    comments.value = comments.value.filter(comment => comment.id !== commentId)
  }

  watch([nodes, edges, dataFlows, comments], syncJsonFromState, { deep: true, immediate: true })
  watch(jsonBuffer, (value, previousValue) => {
    if (isUpdatingFromState.value) return
    if (value === previousValue) return
    debounceApplyFromEditor()
  })

  return {
    schemeId,
    currentVersionId,
    nodes,
    edges,
    dataFlows,
    comments,
    nextNodeId,
    nextEdgeId,
    nextBoundaryId,
    nextCommentId,
    jsonError,
    jsonBuffer,
    isUpdatingFromState,
    isEditorFocused,
    lastSerializedJson,
    isLoading,
    loadError,
    isDirty,
    buildNodeSendableData,
    syncJsonFromState,
    applyJson,
    setDocumentFromServer,
    loadSchemeSnapshot,
    saveCurrentVersion,
    applyRemoteChanges,
    addNode,
    addBoundary,
    addEdge,
    createEdgeId,
    createCommentId,
    setEditorFocused,
    setJsonBuffer,
    updateNode,
    updateEdge,
    updateDataFlows,
    getAbsoluteNodePosition,
    getDescendantNodes,
    getNodeRect,
    alignEdgeToNode,
    maintainPassThroughEdges,
    refreshParentBorders,
    ensureParentPadding,
    findPotentialParentId,
    moveNodeToParent,
    finalizeNodeDrag,
    deleteNode,
    deleteEdge,
    addComment,
    updateComment,
    removeComment,
    resetDocument,
  }
})
