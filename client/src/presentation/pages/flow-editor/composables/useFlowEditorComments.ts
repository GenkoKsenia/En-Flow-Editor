import { computed, ref, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'

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
  const localCommentPatches = ref<Record<string, Partial<Pick<CommentsStoreComment, 'text' | 'position'>>>>({})
  const resolvedCommentIds = ref<string[]>([])

  const { nodes, edges } = storeToRefs(documentStore)
  const { comments: sourceComments, currentAuthor, currentAuthorId, currentAuthorAliases } = storeToRefs(commentsStore)
  const { zoom } = storeToRefs(uiStore)
  const comments = computed<CommentsStoreComment[]>(() =>
    sourceComments.value.map(comment => {
      const patch = localCommentPatches.value[comment.id]
      if (!patch) return comment

      return {
        ...comment,
        text: patch.text ?? comment.text,
        position: patch.position ?? comment.position,
      }
    }),
  )

  watch(sourceComments, nextComments => {
    const existingIds = new Set(nextComments.map(comment => comment.id))
    resolvedCommentIds.value = resolvedCommentIds.value.filter(commentId => existingIds.has(commentId))
  })

  function getSourceComment(commentId: string): CommentsStoreComment | undefined {
    return sourceComments.value.find(comment => comment.id === commentId)
  }

  function setLocalCommentPatch(
    commentId: string,
    patch: Partial<Pick<CommentsStoreComment, 'text' | 'position'>>,
  ): void {
    const sourceComment = getSourceComment(commentId)
    if (!sourceComment) return

    const currentPatch = localCommentPatches.value[commentId] ?? {}
    const nextPatch: Partial<Pick<CommentsStoreComment, 'text' | 'position'>> = {
      ...currentPatch,
      ...patch,
    }

    if (nextPatch.text === sourceComment.text) {
      delete nextPatch.text
    }

    if (
      nextPatch.position &&
      nextPatch.position.x === sourceComment.position.x &&
      nextPatch.position.y === sourceComment.position.y
    ) {
      delete nextPatch.position
    }

    if (typeof nextPatch.text === 'undefined' && !nextPatch.position) {
      const { [commentId]: _removed, ...rest } = localCommentPatches.value
      localCommentPatches.value = rest
      return
    }

    localCommentPatches.value = {
      ...localCommentPatches.value,
      [commentId]: nextPatch,
    }
  }

  function clearLocalCommentPatch(commentId: string): void {
    if (!localCommentPatches.value[commentId]) return

    const { [commentId]: _removed, ...rest } = localCommentPatches.value
    localCommentPatches.value = rest
  }

  function clearResolvedComment(commentId: string): void {
    if (!resolvedCommentIds.value.includes(commentId)) return
    resolvedCommentIds.value = resolvedCommentIds.value.filter(id => id !== commentId)
  }

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
    const comment = getSourceComment(commentId)
    if (!comment) return

    if (comment.status === 'synced') {
      setLocalCommentPatch(commentId, { text })
      return
    }

    commentsStore.updateDraft(commentId, { text })
  }

  function updateCommentPosition(commentId: string, position: Position): void {
    const comment = getSourceComment(commentId)
    if (!comment) return

    if (comment.status === 'synced') {
      setLocalCommentPatch(commentId, { position })
      return
    }

    commentsStore.updateDraft(commentId, { position })
  }

  function submitComment(commentId: string): Promise<void> {
    return commentsStore.submitDraft(commentId)
  }

  function discardComment(commentId: string): void {
    clearLocalCommentPatch(commentId)
    clearResolvedComment(commentId)
    commentsStore.discardDraft(commentId)
  }

  function dismissComment(commentId: string): void {
    clearLocalCommentPatch(commentId)
    clearResolvedComment(commentId)
    commentsStore.dismissComment(commentId)
  }

  function isCommentResolved(commentId: string): boolean {
    return resolvedCommentIds.value.includes(commentId)
  }

  function toggleCommentResolved(commentId: string): void {
    const comment = getSourceComment(commentId)
    if (!comment || comment.status === 'sending') return

    if (resolvedCommentIds.value.includes(commentId)) {
      clearResolvedComment(commentId)
      return
    }

    resolvedCommentIds.value = [...resolvedCommentIds.value, commentId]
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
    comments,
    addCommentForNode,
    addCommentForEdge,
    addCommentOnCanvas,
    getCommentStyle,
    updateCommentText,
    updateCommentPosition,
    submitComment,
    discardComment,
    dismissComment,
    isCommentResolved,
    toggleCommentResolved,
    canDeleteComment,
  }
}
