import type { EditorDocumentContext } from './editorDocument.context'

export function createDocumentCountersUseCases(context: EditorDocumentContext) {
  function refreshCounters(): void {
    let maxNode = 0
    let maxBoundary = 0
    let maxEdge = 0
    let maxComment = 0

    context.nodes.value.forEach(node => {
      const [prefix, rawNumber] = node.id.split('-')
      const number = Number(rawNumber)
      if (!Number.isFinite(number)) return
      if (prefix === 'node') maxNode = Math.max(maxNode, number)
      if (prefix === 'boundary') maxBoundary = Math.max(maxBoundary, number)
    })

    context.edges.value.forEach(edge => {
      const match = edge.id.match(/(\d+)$/)
      const number = match ? Number(match[1]) : Number.NaN
      if (Number.isFinite(number)) {
        maxEdge = Math.max(maxEdge, number)
      }
    })

    context.comments.value.forEach(comment => {
      const match = comment.id.match(/(\d+)$/)
      const number = match ? Number(match[1]) : Number.NaN
      if (Number.isFinite(number)) {
        maxComment = Math.max(maxComment, number)
      }
    })

    context.nextNodeId.value = maxNode + 1
    context.nextBoundaryId.value = maxBoundary + 1
    context.nextEdgeId.value = maxEdge + 1
    context.nextCommentId.value = maxComment + 1
  }

  return {
    refreshCounters,
  }
}
