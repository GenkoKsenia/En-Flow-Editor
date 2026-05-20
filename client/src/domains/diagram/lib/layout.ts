import type { ConnectionSide, Edge, Node, NodeLineStyle, Position } from '@/domains/graph'

type ConnectionMap = Record<string, Record<ConnectionSide, string[]>>
const PARENT_TITLE_CLEARANCE = 28

export type AbsoluteNodeRect = {
  x: number
  y: number
  width: number
  height: number
}

export type NodeBox = Pick<Node, 'width' | 'height'>

function createEmptyConnectionMap(nodes: Node[]): ConnectionMap {
  const map: ConnectionMap = {}

  nodes.forEach(node => {
    map[node.id] = {
      top: [],
      right: [],
      bottom: [],
      left: [],
    }
  })

  return map
}

export function normalizeConnectionEndpointOrders(edges: Edge[]): void {
  const endpointGroups = new Map<string, Array<{
    edge: Edge
    edgeIndex: number
    endpoint: 'source' | 'target'
  }>>()

  edges.forEach((edge, edgeIndex) => {
    const sourceKey = `${edge.sourceNodeId}:${edge.sourceSide}`
    const targetKey = `${edge.targetNodeId}:${edge.targetSide}`

    if (!endpointGroups.has(sourceKey)) {
      endpointGroups.set(sourceKey, [])
    }
    endpointGroups.get(sourceKey)?.push({ edge, edgeIndex, endpoint: 'source' })

    if (!endpointGroups.has(targetKey)) {
      endpointGroups.set(targetKey, [])
    }
    endpointGroups.get(targetKey)?.push({ edge, edgeIndex, endpoint: 'target' })
  })

  endpointGroups.forEach(items => {
    if (!items.length) return

    const hasCompleteOrder = items.every(item => {
      const order = item.endpoint === 'source' ? item.edge.sourceOrder : item.edge.targetOrder
      return typeof order === 'number'
    })

    const orderedItems = hasCompleteOrder
      ? [...items].sort((left, right) => {
        const leftOrder = left.endpoint === 'source' ? left.edge.sourceOrder ?? 0 : left.edge.targetOrder ?? 0
        const rightOrder = right.endpoint === 'source' ? right.edge.sourceOrder ?? 0 : right.edge.targetOrder ?? 0
        return leftOrder - rightOrder || left.edgeIndex - right.edgeIndex
      })
      : items

    orderedItems.forEach((item, index) => {
      if (item.endpoint === 'source') {
        item.edge.sourceOrder = index
        return
      }

      item.edge.targetOrder = index
    })
  })
}

export function buildConnectionPositionMap(nodes: Node[], edges: Edge[]): ConnectionMap {
  const map = createEmptyConnectionMap(nodes)
  const descriptors = new Map<string, Array<{ edgeId: string; order: number; edgeIndex: number }>>()

  edges.forEach((edge, edgeIndex) => {
    const sourceKey = `${edge.sourceNodeId}:${edge.sourceSide}`
    const targetKey = `${edge.targetNodeId}:${edge.targetSide}`

    if (!descriptors.has(sourceKey)) {
      descriptors.set(sourceKey, [])
    }
    descriptors.get(sourceKey)?.push({
      edgeId: edge.id,
      order: edge.sourceOrder ?? edgeIndex,
      edgeIndex,
    })

    if (!descriptors.has(targetKey)) {
      descriptors.set(targetKey, [])
    }
    descriptors.get(targetKey)?.push({
      edgeId: edge.id,
      order: edge.targetOrder ?? edgeIndex,
      edgeIndex,
    })
  })

  descriptors.forEach((items, key) => {
    const [nodeId, side] = key.split(':') as [string, ConnectionSide]
    if (!map[nodeId]) return

    map[nodeId][side] = [...items]
      .sort((left, right) => left.order - right.order || left.edgeIndex - right.edgeIndex)
      .map(item => item.edgeId)
  })

  return map
}

export function roundCoord(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

export function getConnectionPositionFromMap(
  connectionMap: ConnectionMap,
  nodeId: string,
  side: ConnectionSide,
  connectionId: string,
): number {
  const connections = connectionMap[nodeId]?.[side] || []
  const index = connections.indexOf(connectionId)
  if (index === -1) return 0.5
  return (index + 1) / (connections.length + 1)
}

export function getConnectionPoint(
  absolutePosition: Position,
  node: NodeBox,
  side: ConnectionSide,
  position: number,
): Position | null {
  switch (side) {
    case 'top':
      return { x: absolutePosition.x + node.width * position, y: absolutePosition.y }
    case 'right':
      return { x: absolutePosition.x + node.width, y: absolutePosition.y + node.height * position }
    case 'bottom':
      return { x: absolutePosition.x + node.width * position, y: absolutePosition.y + node.height }
    case 'left':
      return { x: absolutePosition.x, y: absolutePosition.y + node.height * position }
    default:
      return null
  }
}

export function toAbsoluteNodeRect(absolutePosition: Position, node: NodeBox): {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
} {
  return {
    left: absolutePosition.x,
    right: absolutePosition.x + node.width,
    top: absolutePosition.y,
    bottom: absolutePosition.y + node.height,
    width: node.width,
    height: node.height,
  }
}

export function clampBreakpointX(edge: Edge, sourceNode: Node, targetNode: Node, x: number): number {
  if (edge.sourceSide === 'left' && edge.targetSide === 'left') {
    const minX = Math.min(sourceNode.position.x, targetNode.position.x) - 200
    const maxX = Math.min(sourceNode.position.x, targetNode.position.x) - 20
    return Math.max(minX, Math.min(maxX, x))
  }

  if (edge.sourceSide === 'right' && edge.targetSide === 'right') {
    const minX = Math.max(
      sourceNode.position.x + sourceNode.width,
      targetNode.position.x + targetNode.width,
    ) + 20
    const maxX = Math.max(
      sourceNode.position.x + sourceNode.width,
      targetNode.position.x + targetNode.width,
    ) + 200
    return Math.max(minX, Math.min(maxX, x))
  }

  const minX = Math.min(sourceNode.position.x, targetNode.position.x) + 10
  const maxX = Math.max(
    sourceNode.position.x + sourceNode.width,
    targetNode.position.x + targetNode.width,
  ) - 10

  return Math.max(minX, Math.min(maxX, x))
}

export function clampBreakpointY(edge: Edge, sourceNode: Node, targetNode: Node, y: number): number {
  if (edge.sourceSide === 'top' && edge.targetSide === 'top') {
    const minY = Math.min(sourceNode.position.y, targetNode.position.y) - 200
    const maxY = Math.min(sourceNode.position.y, targetNode.position.y) - 20
    return Math.max(minY, Math.min(maxY, y))
  }

  if (edge.sourceSide === 'bottom' && edge.targetSide === 'bottom') {
    const minY = Math.max(
      sourceNode.position.y + sourceNode.height,
      targetNode.position.y + targetNode.height,
    ) + 20
    const maxY = Math.max(
      sourceNode.position.y + sourceNode.height,
      targetNode.position.y + targetNode.height,
    ) + 200
    return Math.max(minY, Math.min(maxY, y))
  }

  const minY = Math.min(sourceNode.position.y, targetNode.position.y) + 10
  const maxY = Math.max(
    sourceNode.position.y + sourceNode.height,
    targetNode.position.y + targetNode.height,
  ) - 10

  return Math.max(minY, Math.min(maxY, y))
}

export function findPotentialParentByCenter(
  candidates: Array<{ id: string; rect: AbsoluteNodeRect }>,
  excludedIds: Set<string>,
  draggedRect: AbsoluteNodeRect,
): string | null {
  const draggedCenterX = draggedRect.x + draggedRect.width / 2
  const draggedCenterY = draggedRect.y + draggedRect.height / 2

  for (const candidate of candidates) {
    if (excludedIds.has(candidate.id)) continue

    const isInside =
      draggedCenterX >= candidate.rect.x &&
      draggedCenterX <= candidate.rect.x + candidate.rect.width &&
      draggedCenterY >= candidate.rect.y &&
      draggedCenterY <= candidate.rect.y + candidate.rect.height

    if (isInside) {
      return candidate.id
    }
  }

  return null
}

export function getRequiredParentSize(
  parent: Pick<Node, 'width' | 'height'>,
  children: Array<Pick<Node, 'position' | 'width' | 'height'>>,
  padding: number,
): { width: number; height: number } {
  let requiredWidth = parent.width
  let requiredHeight = parent.height

  children.forEach(child => {
    requiredWidth = Math.max(requiredWidth, child.position.x + child.width + padding)
    requiredHeight = Math.max(requiredHeight, child.position.y + child.height + padding)
  })

  return {
    width: requiredWidth,
    height: requiredHeight,
  }
}

export function getRelativePositionWithinParent(
  currentAbsolutePos: Position,
  parentAbsolutePos: Position,
  padding: number,
): Position {
  return {
    x: roundCoord(Math.max(padding, currentAbsolutePos.x - parentAbsolutePos.x)),
    y: roundCoord(
      Math.max(padding + PARENT_TITLE_CLEARANCE, currentAbsolutePos.y - parentAbsolutePos.y),
    ),
  }
}

export function getParentChildCountMap(nodes: Node[]): Record<string, number> {
  const childCount: Record<string, number> = {}

  nodes.forEach(node => {
    if (node.parentId) {
      childCount[node.parentId] = (childCount[node.parentId] || 0) + 1
    }
  })

  return childCount
}

export function getNodeChildrenCount(nodes: Node[], nodeId: string): number {
  return nodes.filter(node => node.parentId === nodeId).length
}

export function resolveNodeBorderStyle(node: Node, childCount: number): NodeLineStyle {
  if (node.borderStyle === 'database') return 'database'

  const isBoundary = node.text?.startsWith('Область ')
  if (isBoundary) return 'dashed'
  return childCount > 0 ? 'dashed' : 'solid'
}
