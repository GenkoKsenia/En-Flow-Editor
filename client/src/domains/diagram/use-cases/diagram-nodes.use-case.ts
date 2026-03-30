import type { Node } from '@/domains/graph'

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
    const node: Node = {
      id: `node-${context.nextNodeId.value++}`,
      position: { x: 100, y: 100 + context.nodes.value.length * 80 },
      text: `Узел ${context.nodes.value.length + 1}`,
      width: 120,
      height: 60,
      passThroughEdges: [],
      borderStyle: 'solid',
      color: context.defaults.DEFAULT_NODE_COLOR,
      borderColor: context.defaults.DEFAULT_BORDER_COLOR,
      borderWidth: context.defaults.DEFAULT_BORDER_WIDTH,
      borderRadius: context.defaults.DEFAULT_BORDER_RADIUS,
    }

    context.nodes.value.push(node)
    return node
  }

  function addBoundary(): Node {
    const index = getNextBoundaryIndex()
    const node: Node = {
      id: `boundary-${context.nextBoundaryId.value++}`,
      position: { x: 80, y: 80 + context.nodes.value.length * 60 },
      text: `Область ${index}`,
      width: 180,
      height: 150,
      passThroughEdges: [],
      color: context.defaults.DEFAULT_NODE_COLOR,
      borderColor: context.defaults.DEFAULT_BORDER_COLOR,
      borderWidth: context.defaults.DEFAULT_BORDER_WIDTH,
      borderRadius: context.defaults.DEFAULT_BORDER_RADIUS,
      borderStyle: 'dashed',
    }

    context.nodes.value.push(node)
    return node
  }

  function updateNode(nodeId: string, updates: Partial<Node>): void {
    const node = context.nodes.value.find(item => item.id === nodeId)
    if (!node) return

    if (updates.informationIds) {
      dependencies.ensureFlowsForInformation(nodeId, updates.informationIds)
    }

    Object.assign(node, updates)
  }

  function deleteNode(nodeId: string): void {
    context.nodes.value = context.nodes.value.filter(node => node.id !== nodeId)
    context.edges.value = context.edges.value.filter(edge => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId)
  }

  return {
    getNextBoundaryIndex,
    addNode,
    addBoundary,
    updateNode,
    deleteNode,
  }
}
