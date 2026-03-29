import { computed, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'

import { useEditorDocumentStore } from '@/domains/editor-document'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'
import type { ConnectionSide } from '@/domains/graph'

type UseFlowEditorConnectionsOptions = {
  nodeSendableData: ComputedRef<Record<string, string[]>>
  addCommentForNode: (nodeId: string) => void
  addCommentForEdge: (edgeId: string) => void
  addCommentOnCanvas: (event: MouseEvent) => void
  clearSelection: () => void
}

function buildEdgeLabel(
  sourceId: string,
  targetId: string,
  labels: string[],
  sourceName: string,
  targetName: string,
): string {
  const base = `${sourceName || sourceId} → ${targetName || targetId}`
  if (!labels.includes(base)) return base

  let index = 2
  let candidate = `${base} (${index})`
  while (labels.includes(candidate)) {
    index += 1
    candidate = `${base} (${index})`
  }

  return candidate
}

export function useFlowEditorConnections({
  nodeSendableData,
  addCommentForNode,
  addCommentForEdge,
  addCommentOnCanvas,
  clearSelection,
}: UseFlowEditorConnectionsOptions) {
  const documentStore = useEditorDocumentStore()
  const uiStore = useEditorUiStore()

  const { nodes, edges } = storeToRefs(documentStore)
  const {
    isCommentMode,
    isConnectionMode,
    connectionStartNode,
    connectionStartSide,
    hoveredNodeSide,
  } = storeToRefs(uiStore)

  const isConnectionSource = computed(() => (nodeId: string) =>
    isConnectionMode.value && connectionStartNode.value === nodeId,
  )

  const isConnectionTarget = computed(() => (nodeId: string) =>
    isConnectionMode.value && !!connectionStartNode.value && connectionStartNode.value !== nodeId,
  )

  const startConnectionMode = () => uiStore.startConnectionMode()
  const resetConnectionMode = () => uiStore.resetConnectionMode()

  function createConnection(
    sourceId: string,
    sourceSide: ConnectionSide,
    targetId: string,
    targetSide: ConnectionSide,
  ): void {
    const exists = edges.value.some(edge => edge.sourceNodeId === sourceId && edge.targetNodeId === targetId)
    if (exists) return

    const sourceName = nodes.value.find(node => node.id === sourceId)?.text?.trim() ?? ''
    const targetName = nodes.value.find(node => node.id === targetId)?.text?.trim() ?? ''
    const label = buildEdgeLabel(sourceId, targetId, edges.value.map(edge => edge.label ?? ''), sourceName, targetName)

    documentStore.addEdge({
      id: documentStore.createEdgeId(),
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      sourceSide,
      targetSide,
      label,
      lineStyle: 'solid',
      markerType: 'triangle',
      dataKeys: Array.from(new Set(nodeSendableData.value[sourceId] ?? [])),
    })
  }

  function onNodeHoverSide(nodeId: string, side: ConnectionSide | null): void {
    if (isConnectionMode.value) uiStore.setHoveredNode(nodeId, side)
  }

  function onNodeClick(nodeId: string, event: MouseEvent): void {
    event.stopPropagation()

    if (isCommentMode.value) {
      addCommentForNode(nodeId)
      return
    }

    if (!isConnectionMode.value) {
      if (nodes.value.some(node => node.id === nodeId)) uiStore.selectNode(nodeId)
      return
    }

    if (!hoveredNodeSide.value) return
    if (!connectionStartNode.value) {
      uiStore.setConnectionStart(nodeId, hoveredNodeSide.value)
      return
    }

    if (connectionStartNode.value !== nodeId && connectionStartSide.value) {
      createConnection(connectionStartNode.value, connectionStartSide.value, nodeId, hoveredNodeSide.value)
    }

    resetConnectionMode()
  }

  function onEdgeClick(edgeId: string, event: MouseEvent): void {
    event.stopPropagation()

    if (isCommentMode.value) {
      addCommentForEdge(edgeId)
      return
    }

    if (edges.value.some(edge => edge.id === edgeId)) uiStore.selectEdge(edgeId)
  }

  function onCanvasClick(event: MouseEvent): void {
    const target = event.target as Element | null

    if (isCommentMode.value) {
      if (
        target?.closest('.node') ||
        target?.closest('.edge') ||
        target?.closest('.comment-bubble') ||
        target?.closest('.canvas-zoom-controls')
      ) return

      addCommentOnCanvas(event)
      return
    }

    if (isConnectionMode.value && !target?.closest('.node')) {
      resetConnectionMode()
    }

    if (!target?.closest('.node') && !target?.closest('.edge')) {
      clearSelection()
    }
  }

  return {
    isConnectionSource,
    isConnectionTarget,
    startConnectionMode,
    onNodeHoverSide,
    onNodeClick,
    onEdgeClick,
    onCanvasClick,
    resetConnectionMode,
  }
}
