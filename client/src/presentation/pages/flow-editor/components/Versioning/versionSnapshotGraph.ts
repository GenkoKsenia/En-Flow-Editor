import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_EDGE_COLOR,
  DEFAULT_EDGE_WIDTH,
  DEFAULT_NODE_COLOR,
} from '@/constants'
import { findFirstValidBreakpoint, type DiagramDto } from '@/domains/diagram'
import {
  generateEdgeLabel,
  normalizeConnectionEndpointOrders,
  normalizeBorderStyle,
  parseInformationPayload,
  normalizeLineStyle,
  normalizeNodeId,
  unpackConnectionSide,
} from '@/domains/diagram'
import {
  normalizeConnectionSideForBorderStyle,
  type Edge,
  type Node,
} from '@/domains/graph'

type BlockStyle = {
  color?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  borderStyle?: string
}

type ConnectionStyle = {
  color?: string
  width?: number
  type?: string
}

type ParsedSnapshotGraph = {
  nodes: Node[]
  edges: Edge[]
}

function parseCode(code: unknown): DiagramDto | null {
  if (typeof code === 'string') {
    try {
      return JSON.parse(code) as DiagramDto
    } catch {
      return null
    }
  }

  if (code && typeof code === 'object') {
    return code as DiagramDto
  }

  return null
}

function readBlockStyles(styles: DiagramDto['styles']): Record<string, BlockStyle> {
  const blockStyles: Record<string, BlockStyle> = {}

  styles?.blocks?.forEach(style => {
    const elementId = style?.elementId ?? style?.element_id
    if (!elementId) return
    blockStyles[String(elementId)] = {
      color: style.color,
      borderColor: style.borderColor ?? style.border_color,
      borderWidth: typeof (style.borderWidth ?? style.border_width) === 'number'
        ? (style.borderWidth ?? style.border_width)
        : undefined,
      borderRadius: typeof (style.borderRadius ?? style.border_radius) === 'number'
        ? (style.borderRadius ?? style.border_radius)
        : undefined,
      borderStyle: style.borderStyle ?? style.border_style,
    }
  })

  return blockStyles
}

function readConnectionStyles(styles: DiagramDto['styles']): Record<string, ConnectionStyle> {
  const connectionStyles: Record<string, ConnectionStyle> = {}

  styles?.connections?.forEach(style => {
    const elementId = style?.elementId ?? style?.element_id
    if (!elementId) return
    connectionStyles[String(elementId)] = {
      color: style.color,
      width: typeof style.width === 'number' ? style.width : undefined,
      type: style.type,
    }
  })

  return connectionStyles
}

export function parseVersionSnapshotGraph(code: unknown): ParsedSnapshotGraph {
  const parsed = parseCode(code)
  if (!parsed) {
    return { nodes: [], edges: [] }
  }

  const parsedBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : []
  const parsedConnections = Array.isArray(parsed.connections) ? parsed.connections : []
  const blockStyles = readBlockStyles(parsed.styles ?? null)
  const connectionStyles = readConnectionStyles(parsed.styles ?? null)
  const nodeIdMap: Record<string, string> = {}
  const passThroughByNode: Record<string, string[]> = {}

  parsedConnections.forEach(connection => {
    const through = Array.isArray(connection?.through) ? connection.through : []
    through.forEach(blockId => {
      const normalizedId = normalizeNodeId(blockId) ?? String(blockId)
      if (!passThroughByNode[normalizedId]) {
        passThroughByNode[normalizedId] = []
      }
      if (connection?.id) {
        passThroughByNode[normalizedId].push(String(connection.id))
      }
    })
  })

  const tempNodes = parsedBlocks
    .map(block => {
      if (!block?.id) return null

      const rawId = String(block.id)
      const normalizedId = normalizeNodeId(rawId)
      if (!normalizedId) return null

      nodeIdMap[rawId] = normalizedId
      const style = blockStyles[rawId]
      const informationPayload = parseInformationPayload(
        (block as { information?: unknown }).information,
        (block as { informationText?: unknown }).informationText,
      )

      return {
        id: normalizedId,
        text: block.name ?? '',
        position: {
          x: typeof block.position?.x === 'number' ? block.position.x : 0,
          y: typeof block.position?.y === 'number' ? block.position.y : 0,
        },
        width: typeof block.width === 'number' ? block.width : 120,
        height: typeof block.height === 'number' ? block.height : 60,
        rawParentId: block.parentId,
        passThroughEdges: passThroughByNode[normalizedId] ?? [],
        color: style?.color ?? DEFAULT_NODE_COLOR,
        borderColor: style?.borderColor ?? DEFAULT_BORDER_COLOR,
        borderWidth: style?.borderWidth ?? DEFAULT_BORDER_WIDTH,
        borderRadius: style?.borderRadius ?? DEFAULT_BORDER_RADIUS,
        borderStyle: normalizeBorderStyle(style?.borderStyle),
        informationIds: informationPayload.ids,
        informationText: informationPayload.text,
      }
    })
    .filter(Boolean)

  const nodes: Node[] = tempNodes.map(node => ({
    id: node.id,
    text: node.text,
    position: node.position,
    width: node.width,
    height: node.height,
    parentId: node.rawParentId
      ? (nodeIdMap[String(node.rawParentId)] ?? normalizeNodeId(node.rawParentId)) ?? undefined
      : undefined,
    passThroughEdges: node.passThroughEdges,
    color: node.color,
    borderColor: node.borderColor,
    borderWidth: node.borderWidth,
    borderRadius: node.borderRadius,
    borderStyle: node.borderStyle,
    informationIds: node.informationIds,
    informationText: node.informationText,
  }))
  const nodeBorderStyles = new Map(nodes.map(node => [node.id, node.borderStyle]))

  const nodeLabelMap = new Map(nodes.map(node => [node.id, node.text.trim() || node.id]))
  const existingEdgeLabels: string[] = []

  const edges: Edge[] = parsedConnections
    .map(connection => {
      if (!connection?.id || !connection?.startBlock || !connection?.endBlock) return null

      const startId = nodeIdMap[String(connection.startBlock)] ?? normalizeNodeId(connection.startBlock)
      const endId = nodeIdMap[String(connection.endBlock)] ?? normalizeNodeId(connection.endBlock)
      if (!startId || !endId) return null

      const style = connectionStyles[String(connection.id)]
      const breakpoint = findFirstValidBreakpoint(connection.breakpoints)
      const labelRaw = (connection.label ?? '').trim()
      const label = labelRaw || generateEdgeLabel(startId, endId, existingEdgeLabels, nodeId => nodeLabelMap.get(nodeId) ?? nodeId)
      const sourceEndpoint = unpackConnectionSide(connection.startSide)
      const targetEndpoint = unpackConnectionSide(connection.endSide)
      existingEdgeLabels.push(label)

      return {
        id: String(connection.id),
        sourceNodeId: startId,
        targetNodeId: endId,
        sourceSide: normalizeConnectionSideForBorderStyle(
          sourceEndpoint.side,
          nodeBorderStyles.get(startId),
        ),
        targetSide: normalizeConnectionSideForBorderStyle(
          targetEndpoint.side,
          nodeBorderStyles.get(endId),
        ),
        sourceOrder: sourceEndpoint.order ?? (
          typeof connection.startOrder === 'number' ? connection.startOrder : undefined
        ),
        targetOrder: targetEndpoint.order ?? (
          typeof connection.endOrder === 'number' ? connection.endOrder : undefined
        ),
        label,
        color: style?.color ?? DEFAULT_EDGE_COLOR,
        width: style?.width ?? DEFAULT_EDGE_WIDTH,
        lineStyle: normalizeLineStyle(style?.type),
        markerType: 'triangle',
        breakpointX: breakpoint?.x,
        breakpointY: breakpoint?.y,
        breakpointLocked: false,
        geometry: undefined,
        dataKeys: Array.isArray(connection.dataKeys) ? connection.dataKeys.map(key => String(key)) : [],
      } satisfies Edge
    })
    .filter((edge): edge is Edge => Boolean(edge))

  normalizeConnectionEndpointOrders(edges)

  return { nodes, edges }
}
