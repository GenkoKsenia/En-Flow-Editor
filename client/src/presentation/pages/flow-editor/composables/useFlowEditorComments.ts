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
    const commentsById = new Map(nextComments.map(comment => [comment.id, comment]))
    const nextPatches: Record<string, Partial<Pick<CommentsStoreComment, 'text' | 'position'>>> = {}

    Object.entries(localCommentPatches.value).forEach(([commentId, patch]) => {
      const sourceComment = commentsById.get(commentId)
      if (!sourceComment || sourceComment.status !== 'synced') {
        return
      }

      const nextPatch = { ...patch }
      if (typeof nextPatch.text === 'string' && nextPatch.text === sourceComment.text) {
        delete nextPatch.text
      }

      if (
        nextPatch.position
        && nextPatch.position.x === sourceComment.position.x
        && nextPatch.position.y === sourceComment.position.y
      ) {
        delete nextPatch.position
      }

      if (typeof nextPatch.text !== 'undefined' || nextPatch.position) {
        nextPatches[commentId] = nextPatch
      }
    })

    localCommentPatches.value = nextPatches
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

  function hasPendingChanges(commentId: string): boolean {
    const patch = localCommentPatches.value[commentId]
    if (!patch) return false

    if (typeof patch.text !== 'undefined') return true
    return Boolean(patch.position)
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

  async function submitComment(commentId: string): Promise<void> {
    const comment = getSourceComment(commentId)
    if (!comment) return

    if (comment.status !== 'synced') {
      await commentsStore.submitDraft(commentId)
      return
    }

    const patch = localCommentPatches.value[commentId]
    if (!patch) return

    await commentsStore.saveSyncedComment(commentId, patch)
    clearLocalCommentPatch(commentId)
  }

  function discardComment(commentId: string): void {
    clearLocalCommentPatch(commentId)
    commentsStore.discardDraft(commentId)
  }

  function cancelComment(commentId: string): void {
    const comment = getSourceComment(commentId)
    if (!comment) return

    if (comment.status === 'synced') {
      clearLocalCommentPatch(commentId)
      return
    }

    discardComment(commentId)
  }

  function isCommentResolved(commentId: string): boolean {
    return Boolean(getSourceComment(commentId)?.completionDate)
  }

  async function toggleCommentResolved(commentId: string): Promise<void> {
    const comment = getSourceComment(commentId)
    if (!comment || comment.status !== 'synced' || comment.completionDate) return

    await commentsStore.completeComment(commentId)
    clearLocalCommentPatch(commentId)
  }

  async function deleteComment(commentId: string): Promise<void> {
    await commentsStore.deleteComment(commentId)
    clearLocalCommentPatch(commentId)
  }

  function commitCommentPosition(commentId: string): void {
    const comment = getSourceComment(commentId)
    const patch = localCommentPatches.value[commentId]
    if (!comment || comment.status !== 'synced' || !patch?.position) return

    void submitComment(commentId)
  }

  function canEditComment(comment: CommentsStoreComment): boolean {
    return comment.status !== 'sending' && !comment.completionDate
  }

  function showCommentActions(commentId: string): boolean {
    const comment = getSourceComment(commentId)
    if (!comment) return false

    if (comment.status === 'draft' || comment.status === 'error') {
      return true
    }

    return hasPendingChanges(commentId)
  }

  function canResolveComment(comment: CommentsStoreComment): boolean {
    return comment.status === 'synced' && !comment.completionDate
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
    canEditComment,
    showCommentActions,
    canResolveComment,
    updateCommentText,
    updateCommentPosition,
    commitCommentPosition,
    submitComment,
    cancelComment,
    deleteComment,
    isCommentResolved,
    toggleCommentResolved,
    canDeleteComment,
  }
}
