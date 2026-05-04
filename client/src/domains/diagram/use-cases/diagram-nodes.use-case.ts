import type { Node } from '@/domains/graph'
import { findFreeLeftPlacement } from '@/domains/diagram/lib'

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

    context.nodes.value.push(node)
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
    addBoundary,
    updateNode,
    deleteNode,
  }
}
