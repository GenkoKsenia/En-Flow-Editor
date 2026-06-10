import {
  normalizeConnectionSideForBorderStyle,
  type Node,
} from '@/domains/graph'
import {
  findFreeLeftPlacement,
  normalizeConnectionEndpointOrders,
  setNodeBorderStyleMode,
} from '@/domains/diagram/lib'

import type { DiagramContext } from './diagram.context'

type DiagramNodesDependencies = {
  ensureFlowsForInformation: (nodeId: string, infoIds: string[]) => void
}

export function createDiagramNodesUseCases(
  context: DiagramContext,
  dependencies: DiagramNodesDependencies,
) {
  function getNextBoundaryIndex(): number {
    const prefix = 'Область '
    const indices = context.nodes.value
      .map(node => (node.text?.startsWith(prefix) ? Number(node.text.slice(prefix.length)) : Number.NaN))
      .filter((value): value is number => Number.isFinite(value))
    return indices.length ? Math.max(...indices) + 1 : 1
  }

  function addNode(): Node {
    const width = 120
    const height = 60
    const node: Node = {
      id: `node-${context.nextNodeId.value++}`,
      position: findFreeLeftPlacement(context.nodes.value, { width, height }),
      text: `Узел ${context.nodes.value.length + 1}`,
      width,
      height,
      passThroughEdges: [],
      borderStyle: 'solid',
      color: context.defaults.DEFAULT_NODE_COLOR,
      borderColor: context.defaults.DEFAULT_BORDER_COLOR,
      borderWidth: context.defaults.DEFAULT_BORDER_WIDTH,
      borderRadius: context.defaults.DEFAULT_BORDER_RADIUS,
    }

    setNodeBorderStyleMode(node, 'auto')
    context.nodes.value.push(node)
    return node
  }

  function addDatabaseNode(): Node {
    const node = addNode()
    node.borderStyle = 'database'
    setNodeBorderStyleMode(node, 'manual')
    return node
  }

  function addBoundary(): Node {
    const index = getNextBoundaryIndex()
    const width = 180
    const height = 150
    const node: Node = {
      id: `boundary-${context.nextBoundaryId.value++}`,
      position: findFreeLeftPlacement(
        context.nodes.value,
        { width, height },
        { defaultPosition: { x: 80, y: 80 } },
      ),
      text: `Область ${index}`,
      width,
      height,
      passThroughEdges: [],
      color: context.defaults.DEFAULT_NODE_COLOR,
      borderColor: context.defaults.DEFAULT_BORDER_COLOR,
      borderWidth: context.defaults.DEFAULT_BORDER_WIDTH,
      borderRadius: context.defaults.DEFAULT_BORDER_RADIUS,
      borderStyle: 'dashed',
    }

    setNodeBorderStyleMode(node, 'auto')
    context.nodes.value.push(node)
    return node
  }

  function normalizeConnectedEdgeSides(nodeId: string): string[] {
    const node = context.nodes.value.find(item => item.id === nodeId)
    if (!node) return []

    const affectedEdgeIds: string[] = []

    context.edges.value.forEach(edge => {
      let changed = false

      if (edge.sourceNodeId === nodeId) {
        const nextSourceSide = normalizeConnectionSideForBorderStyle(edge.sourceSide, node.borderStyle)
        if (nextSourceSide !== edge.sourceSide) {
          edge.sourceSide = nextSourceSide
          changed = true
        }
      }

      if (edge.targetNodeId === nodeId) {
        const nextTargetSide = normalizeConnectionSideForBorderStyle(edge.targetSide, node.borderStyle)
        if (nextTargetSide !== edge.targetSide) {
          edge.targetSide = nextTargetSide
          changed = true
        }
      }

      if (changed) {
        affectedEdgeIds.push(edge.id)
      }
    })

    if (affectedEdgeIds.length) {
      normalizeConnectionEndpointOrders(context.edges.value)
    }

    return affectedEdgeIds
  }

  function updateNode(nodeId: string, updates: Partial<Node>): string[] {
    const node = context.nodes.value.find(item => item.id === nodeId)
    if (!node) return []

    if (updates.informationIds) {
      dependencies.ensureFlowsForInformation(nodeId, updates.informationIds)
    }

    Object.assign(node, updates)
    if (Object.prototype.hasOwnProperty.call(updates, 'borderStyle')) {
      setNodeBorderStyleMode(node, 'manual')
    }
    return normalizeConnectedEdgeSides(nodeId)
  }

  function deleteNode(nodeId: string): void {
    context.nodes.value = context.nodes.value.filter(node => node.id !== nodeId)
    context.edges.value = context.edges.value.filter(edge => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId)
    normalizeConnectionEndpointOrders(context.edges.value)
    context.dataFlows.value = context.dataFlows.value
      .filter(flow => flow.startBlock !== nodeId)
      .map(flow => ({
        ...flow,
        finishBlocks: (flow.finishBlocks ?? []).filter(finishBlockId => finishBlockId !== nodeId),
      }))
  }

  return {
    getNextBoundaryIndex,
    addNode,
    addDatabaseNode,
    addBoundary,
    updateNode,
    deleteNode,
  }
}
