import type { Edge } from '@/domains/graph'

import { encodeTargetId } from '../lib'

import type { EditorDocumentContext } from './editorDocument.context'

type DocumentEdgesDependencies = {
  buildNodeSendableData: () => Record<string, string[]>
}

export function createDocumentEdgesUseCases(
  context: EditorDocumentContext,
  dependencies: DocumentEdgesDependencies,
) {
  function addEdge(edge: Edge): void {
    context.edges.value.push(edge)
    const match = edge.id.match(/(\d+)$/)
    const number = match ? Number(match[1]) : Number.NaN
    if (Number.isFinite(number)) {
      context.nextEdgeId.value = Math.max(context.nextEdgeId.value, number + 1)
    }
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
    context.comments.value = context.comments.value.filter(comment => comment.targetId !== encodeTargetId('edge', edgeId))
  }

  return {
    addEdge,
    createEdgeId,
    updateEdge,
    deleteEdge,
  }
}
