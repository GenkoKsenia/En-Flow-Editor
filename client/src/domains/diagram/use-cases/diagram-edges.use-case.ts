import type { Edge } from '@/domains/graph'

import type { DiagramContext } from './diagram.context'

type DiagramEdgesDependencies = {
  buildNodeSendableData: () => Record<string, string[]>
}

export function createDiagramEdgesUseCases(
  context: DiagramContext,
  dependencies: DiagramEdgesDependencies,
) {
  function addEdge(edge: Edge): Edge {
    context.edges.value.push(edge)
    const match = edge.id.match(/(\d+)$/)
    const number = match ? Number(match[1]) : Number.NaN
    if (Number.isFinite(number)) {
      context.nextEdgeId.value = Math.max(context.nextEdgeId.value, number + 1)
    }

    return edge
  }

  function createEdgeId(): string {
    return `edge-${context.nextEdgeId.value++}`
  }

  function updateEdge(edgeId: string, updates: Partial<Edge>): void {
    const edge = context.edges.value.find(item => item.id === edgeId)
    if (!edge) return

    if (updates.dataKeys) {
      const allowed = dependencies.buildNodeSendableData()[edge.sourceNodeId] ?? []
      updates = {
        ...updates,
        dataKeys: Array.from(new Set(updates.dataKeys.filter(id => allowed.includes(id)))),
      }
    }

    Object.assign(edge, updates)
  }

  function deleteEdge(edgeId: string): void {
    context.edges.value = context.edges.value.filter(edge => edge.id !== edgeId)
  }

  return {
    addEdge,
    createEdgeId,
    updateEdge,
    deleteEdge,
  }
}
