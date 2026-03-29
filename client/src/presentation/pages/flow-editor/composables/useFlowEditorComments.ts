import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'

import { decodeTargetId, encodeTargetId } from '@/domains/editor-document'
import { useEditorDocumentStore } from '@/domains/editor-document'
import { MOCK_CURRENT_USER_NAME } from '@/mocks'
import type { EditorComment } from '@/domains/editor-document'
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
      author: MOCK_CURRENT_USER_NAME,
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
      author: MOCK_CURRENT_USER_NAME,
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
      author: MOCK_CURRENT_USER_NAME,
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
