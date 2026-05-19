import { computed, type Ref } from 'vue'

import {
  buildConnectionPositionMap,
  buildOrthogonalEdgeSegments,
  doesSegmentsPassThroughRect,
} from '@/domains/diagram'
import {
  getConnectionPoint,
  getConnectionPositionFromMap,
  getNodeChildrenCount,
} from '@/domains/diagram'
import type { ConnectionSide, Edge, Node, Position, Segment } from '@/domains/graph'

type NodeRect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

type UseFlowGraphViewOptions = {
  nodes: Ref<Node[]>
  edges: Ref<Edge[]>
  getAbsoluteNodePosition: (node: Node) => Position
  getNodeRect: (node: Node) => NodeRect
}

function distance(a: Position, b: Position): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function useFlowGraphView({
  nodes,
  edges,
  getAbsoluteNodePosition,
  getNodeRect,
}: UseFlowGraphViewOptions) {
  const connectionPositions = computed(() => {
    return buildConnectionPositionMap(nodes.value, edges.value)
  })

  function getConnectionPosition(nodeId: string, side: ConnectionSide, connectionId: string): number {
    return getConnectionPositionFromMap(connectionPositions.value, nodeId, side, connectionId)
  }

  function getConnectionPointForEdge(nodeId: string, side: ConnectionSide, edgeId: string): Position | null {
    const node = nodes.value.find(item => item.id === nodeId)
    if (!node) return null

    const absolutePosition = getAbsoluteNodePosition(node)
    const position = getConnectionPosition(nodeId, side, edgeId)
    return getConnectionPoint(absolutePosition, node, side, position)
  }

  function getEdgeSegments(edge: Edge): Segment[] {
    const start = getConnectionPointForEdge(edge.sourceNodeId, edge.sourceSide, edge.id)
    const end = getConnectionPointForEdge(edge.targetNodeId, edge.targetSide, edge.id)
    if (!start || !end) return []

    return buildOrthogonalEdgeSegments(edge, start, end)
  }

  function doesEdgePassThroughNode(edge: Edge, node: Node): boolean {
    return doesSegmentsPassThroughRect(getEdgeSegments(edge), getNodeRect(node))
  }

  function getChildrenCount(nodeId: string): number {
    return getNodeChildrenCount(nodes.value, nodeId)
  }

  function getEdgeAnchor(edge: Edge): Position {
    const segments = getEdgeSegments(edge)
    if (!segments.length) return { x: 0, y: 0 }

    let total = 0
    segments.forEach(segment => {
      total += distance(segment.start, segment.end)
    })

    let target = total / 2
    for (const segment of segments) {
      const length = distance(segment.start, segment.end)
      if (target <= length) {
        const ratio = target / length
        return {
          x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
          y: segment.start.y + (segment.end.y - segment.start.y) * ratio,
        }
      }
      target -= length
    }

    return segments[segments.length - 1]?.end ?? { x: 0, y: 0 }
  }

  return {
    connectionPositions,
    getConnectionPosition,
    getConnectionPointForEdge,
    getEdgeSegments,
    doesEdgePassThroughNode,
    getChildrenCount,
    getEdgeAnchor,
  }
}
