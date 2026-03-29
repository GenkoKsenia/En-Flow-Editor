import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'

import { useEditorDocumentStore, useEditorUiStore } from '@/stores'
import type { CommentTarget, EditorComment, Edge, Node, Position } from '@/models'
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

function encodeTargetId(type: CommentTarget, id: string | null): string {
  if (type === 'canvas') return 'canvas'
  return `${type}:${id ?? ''}`
}

function decodeTargetId(
  raw: string | null | undefined,
): { type: CommentTarget; id: string | null } {
  if (raw === 'canvas') return { type: 'canvas', id: null }
  if (typeof raw === 'string' && raw.startsWith('node:')) {
    return { type: 'node', id: raw.slice('node:'.length) || null }
  }
  if (typeof raw === 'string' && raw.startsWith('edge:')) {
    return { type: 'edge', id: raw.slice('edge:'.length) || null }
  }
  return { type: 'node', id: raw ?? null }
}

export function useFlowEditorComments({
  canvasContent,
  getNodeRect,
  getEdgeAnchor,
}: UseFlowEditorCommentsOptions) {
  const documentStore = useEditorDocumentStore()
  const uiStore = useEditorUiStore()

  const { nodes, edges } = storeToRefs(documentStore)
  const { zoom } = storeToRefs(uiStore)

  const makeCommentId = () => documentStore.createCommentId()

  function addCommentForNode(nodeId: string): void {
    const node = nodes.value.find(item => item.id === nodeId)
    if (!node) return

    const rect = getNodeRect(node)
    documentStore.addComment({
      id: makeCommentId(),
      targetId: encodeTargetId('node', nodeId),
      offset: { x: rect.width + 12, y: 0 },
      text: '',
      author: 'User',
      createdAt: new Date().toLocaleString('ru-RU'),
    })
  }

  function addCommentForEdge(edgeId: string): void {
    const edge = edges.value.find(item => item.id === edgeId)
    if (!edge) return

    documentStore.addComment({
      id: makeCommentId(),
      targetId: encodeTargetId('edge', edgeId),
      offset: { x: 12, y: -12 },
      text: '',
      author: 'User',
      createdAt: new Date().toLocaleString('ru-RU'),
    })
  }

  function addCommentOnCanvas(event: MouseEvent): void {
    if (!canvasContent.value) return

    const rect = canvasContent.value.getBoundingClientRect()
    const scale = zoom.value || 1
    documentStore.addComment({
      id: makeCommentId(),
      targetId: encodeTargetId('canvas', null),
      offset: {
        x: (event.clientX - rect.left) / scale,
        y: (event.clientY - rect.top) / scale,
      },
      text: '',
      author: 'User',
      createdAt: new Date().toLocaleString('ru-RU'),
    })
  }

  function getCommentStyle(comment: EditorComment): Record<string, string> {
    let left = comment.offset.x
    let top = comment.offset.y

    const { type, id } = decodeTargetId(comment.targetId)

    if (type === 'node' && id) {
      const node = nodes.value.find(item => item.id === id)
      if (node) {
        const rect = getNodeRect(node)
        left = rect.left + comment.offset.x
        top = rect.top + comment.offset.y
      }
    }

    if (type === 'edge' && id) {
      const edge = edges.value.find(item => item.id === id)
      if (edge) {
        const anchor = getEdgeAnchor(edge)
        left = anchor.x + comment.offset.x
        top = anchor.y + comment.offset.y
      }
    }

    return {
      left: `${left}px`,
      top: `${top}px`,
    }
  }

  const removeComment = (commentId: string) => documentStore.removeComment(commentId)

  return {
    addCommentForNode,
    addCommentForEdge,
    addCommentOnCanvas,
    getCommentStyle,
    removeComment,
  }
}
