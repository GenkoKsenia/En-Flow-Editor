import { computed, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'

import { useDiagramStore } from '@/domains/diagram'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'
import {
  normalizeConnectionSideForBorderStyle,
  type ConnectionSide,
  type Edge,
} from '@/domains/graph'

type UseFlowEditorConnectionsOptions = {
  nodeSendableData: ComputedRef<Record<string, string[]>>
  addCommentForNode: (nodeId: string) => boolean
  addCommentForEdge: (edgeId: string) => boolean
  addCommentOnCanvas: (event: MouseEvent) => boolean
  createEdge: (edge: Edge) => void
  clearSelection: () => Promise<void> | void
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
  createEdge,
  clearSelection,
}: UseFlowEditorConnectionsOptions) {
  const documentStore = useDiagramStore()
  const uiStore = useEditorUiStore()

  const { nodes, edges, isReadOnly } = storeToRefs(documentStore)
  const {
    isCommentMode,
    isConnectionMode,
    connectionStartNode,
    connectionStartSide,
    hoveredNodeId,
    hoveredNodeSide,
    selectedNodeIds,
    selectedEdgeIds,
  } = storeToRefs(uiStore)

  const isConnectionSource = computed(() => (nodeId: string) =>
    isConnectionMode.value && connectionStartNode.value === nodeId,
  )

  const isConnectionTarget = computed(() => (nodeId: string) =>
    isConnectionMode.value
      && !!connectionStartNode.value
      && connectionStartNode.value !== nodeId
      && !edges.value.some(edge => edge.sourceNodeId === connectionStartNode.value && edge.targetNodeId === nodeId)
      && !(hoveredNodeId.value === nodeId && hoveredNodeSide.value),
  )

  const startConnectionMode = () => {
    if (isReadOnly.value) return
    uiStore.startConnectionMode()
  }
  const resetConnectionMode = () => uiStore.resetConnectionMode()

  function buildPendingEdge(
    sourceId: string,
    sourceSide: ConnectionSide,
    targetId: string,
    targetSide: ConnectionSide,
  ) {
    return {
      id: documentStore.createEdgeId(),
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      sourceSide,
      targetSide,
      label: '',
      lineStyle: 'solid' as const,
      markerType: 'triangle' as const,
      dataKeys: [] as string[],
    }
  }

  function createConnection(
    sourceId: string,
    sourceSide: ConnectionSide,
    targetId: string,
    targetSide: ConnectionSide,
  ): void {
    const exists = edges.value.some(edge => edge.sourceNodeId === sourceId && edge.targetNodeId === targetId)
    if (exists) return

    const sourceNode = nodes.value.find(node => node.id === sourceId)
    const targetNode = nodes.value.find(node => node.id === targetId)
    const sourceName = sourceNode?.text?.trim() ?? ''
    const targetName = targetNode?.text?.trim() ?? ''
    const label = buildEdgeLabel(sourceId, targetId, edges.value.map(edge => edge.label ?? ''), sourceName, targetName)
    const normalizedSourceSide = normalizeConnectionSideForBorderStyle(sourceSide, sourceNode?.borderStyle)
    const normalizedTargetSide = normalizeConnectionSideForBorderStyle(targetSide, targetNode?.borderStyle)

    createEdge({
      ...buildPendingEdge(sourceId, normalizedSourceSide, targetId, normalizedTargetSide),
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      label,
      dataKeys: Array.from(new Set(nodeSendableData.value[sourceId] ?? [])),
    })
  }

  function onNodeHoverSide(nodeId: string, side: ConnectionSide | null): void {
    if (isConnectionMode.value) uiStore.setHoveredNode(nodeId, side)
  }

  async function onNodeClick(nodeId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation()

    if (uiStore.consumeSelectionClickSuppression()) return

    if (isCommentMode.value) {
      if (addCommentForNode(nodeId)) {
        uiStore.stopCommentMode()
      }
      return
    }

    if (!isConnectionMode.value) {
      if (!nodes.value.some(node => node.id === nodeId)) return
      if (event.ctrlKey || event.metaKey) {
        uiStore.toggleNodeSelection(nodeId)
        return
      }
      if (selectedNodeIds.value.length > 1 && selectedNodeIds.value.includes(nodeId)) {
        return
      }

      if (isReadOnly.value) {
        await clearSelection()
        uiStore.selectNode(nodeId)
        return
      }

      if (uiStore.selectedNodeId === nodeId) {
        const locked = await documentStore.beginNodeEdit(nodeId)
        if (!locked) return
        uiStore.selectNode(nodeId)
        return
      }

      await clearSelection()
      const locked = await documentStore.beginNodeEdit(nodeId)
      if (!locked) return
      uiStore.selectNode(nodeId)
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

  async function onEdgeClick(edgeId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation()

    if (uiStore.consumeSelectionClickSuppression()) return

    if (isCommentMode.value) {
      if (addCommentForEdge(edgeId)) {
        uiStore.stopCommentMode()
      }
      return
    }

    if (!edges.value.some(edge => edge.id === edgeId)) return
    if (event.ctrlKey || event.metaKey) {
      uiStore.toggleEdgeSelection(edgeId)
      return
    }
    if (selectedEdgeIds.value.length > 1 && selectedEdgeIds.value.includes(edgeId)) {
      return
    }

    if (isReadOnly.value) {
      await clearSelection()
      uiStore.selectEdge(edgeId)
      return
    }

    if (uiStore.selectedEdgeId === edgeId) {
      const locked = await documentStore.beginEdgeEdit(edgeId)
      if (!locked) return
      uiStore.selectEdge(edgeId)
      return
    }

    await clearSelection()
    const locked = await documentStore.beginEdgeEdit(edgeId)
    if (!locked) return
    uiStore.selectEdge(edgeId)
  }

  function onCanvasClick(event: MouseEvent): void {
    if (uiStore.consumeSelectionClickSuppression()) return

    const target = event.target as Element | null

    if (isCommentMode.value) {
      if (
        target?.closest('.node') ||
        target?.closest('.edge') ||
        target?.closest('.lock-badge') ||
        target?.closest('.comment-bubble') ||
        target?.closest('.canvas-zoom-controls') ||
        target?.closest('.properties-panel') ||
        target?.closest('.diagnostics-panel')
      ) return

      if (addCommentOnCanvas(event)) {
        uiStore.stopCommentMode()
      }
      return
    }

    if (isConnectionMode.value && !target?.closest('.node')) {
      resetConnectionMode()
    }

    if (
      !target?.closest('.node') &&
      !target?.closest('.edge') &&
      !target?.closest('.lock-badge') &&
      !target?.closest('.properties-panel') &&
      !target?.closest('.diagnostics-panel')
    ) {
      void clearSelection()
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
