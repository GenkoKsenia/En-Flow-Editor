import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'

import { useDiagramStore } from '@/domains/diagram'
import { useCommentsStore, type CommentsStoreComment } from '@/domains/comments'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'
import type { Edge, Node, Position } from '@/domains/graph'
type NodeRect = {
  left: number
  top: number
  width: number
  height: number
}

type UseFlowEditorCommentsOptions = {
  canvasContent: Ref<HTMLElement | null>
  getNodeRect: (node: Node) => NodeRect
  getEdgeAnchor: (edge: Edge) => Position
}

export function useFlowEditorComments({
  canvasContent,
  getNodeRect,
  getEdgeAnchor,
}: UseFlowEditorCommentsOptions) {
  const documentStore = useDiagramStore()
  const commentsStore = useCommentsStore()
  const uiStore = useEditorUiStore()

  const { nodes, edges } = storeToRefs(documentStore)
  const { currentAuthor, currentAuthorId, currentAuthorAliases } = storeToRefs(commentsStore)
  const { zoom } = storeToRefs(uiStore)

  function addCommentForNode(nodeId: string): boolean {
    const node = nodes.value.find(item => item.id === nodeId)
    if (!node) return false

    const rect = getNodeRect(node)
    commentsStore.startDraft('node', nodeId, { x: rect.width + 12, y: 0 })
    return true
  }

  function addCommentForEdge(edgeId: string): boolean {
    const edge = edges.value.find(item => item.id === edgeId)
    if (!edge) return false

    commentsStore.startDraft('edge', edgeId, { x: 12, y: -12 })
    return true
  }

  function addCommentOnCanvas(event: MouseEvent): boolean {
    if (!canvasContent.value) return false

    const rect = canvasContent.value.getBoundingClientRect()
    const scale = zoom.value || 1
    commentsStore.startDraft('canvas', null, {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale,
    })
    return true
  }

  function getCommentStyle(comment: CommentsStoreComment): Record<string, string> {
    let left = comment.position.x
    let top = comment.position.y

    if (comment.targetType === 'node' && comment.targetId) {
      const node = nodes.value.find(item => item.id === comment.targetId)
      if (node) {
        const rect = getNodeRect(node)
        left = rect.left + comment.position.x
        top = rect.top + comment.position.y
      }
    }

    if (comment.targetType === 'edge' && comment.targetId) {
      const edge = edges.value.find(item => item.id === comment.targetId)
      if (edge) {
        const anchor = getEdgeAnchor(edge)
        left = anchor.x + comment.position.x
        top = anchor.y + comment.position.y
      }
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
    }
  }

  function updateCommentText(commentId: string, text: string): void {
    commentsStore.updateDraft(commentId, { text })
  }

  function updateCommentPosition(commentId: string, position: Position): void {
    commentsStore.updateDraft(commentId, { position })
  }

  function submitComment(commentId: string): Promise<void> {
    return commentsStore.submitDraft(commentId)
  }

  function discardComment(commentId: string): void {
    commentsStore.discardDraft(commentId)
  }

  function dismissComment(commentId: string): void {
    commentsStore.dismissComment(commentId)
  }

  function canDeleteComment(comment: CommentsStoreComment): boolean {
    if (comment.status !== 'synced') return false

    const aliases = new Set([
      ...currentAuthorAliases.value,
      currentAuthor.value,
      currentAuthorId.value ?? '',
    ].filter(Boolean))

    if (aliases.size === 0 || (aliases.size === 1 && aliases.has('User'))) {
      return true
    }

    if (comment.authorId && aliases.has(comment.authorId)) {
      return true
    }

    return aliases.has(comment.author)
  }

  return {
    addCommentForNode,
    addCommentForEdge,
    addCommentOnCanvas,
    getCommentStyle,
    updateCommentText,
    updateCommentPosition,
    submitComment,
    discardComment,
    dismissComment,
    canDeleteComment,
  }
}
