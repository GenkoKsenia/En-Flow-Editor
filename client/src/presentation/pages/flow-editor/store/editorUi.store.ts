import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { SelectedObject, TeamMember, VersionRecord } from '@/domains/diagram'
import type { ConnectionSide, Position } from '@/domains/graph'
import { useDiagramStore } from '@/domains/diagram'

type MarqueeRect = {
  x: number
  y: number
  width: number
  height: number
}

export const useEditorUiStore = defineStore('editorUi', () => {
  const diagramStore = useDiagramStore()

  const selectedNodeIds = ref<string[]>([])
  const selectedEdgeIds = ref<string[]>([])
  const isDragging = ref(false)
  const isDraggingBreakpoint = ref(false)
  const draggingEdgeId = ref<string | null>(null)
  const potentialParentId = ref<string | null>(null)
  const isMarqueeSelecting = ref(false)
  const marqueeStart = ref<Position | null>(null)
  const marqueeCurrent = ref<Position | null>(null)
  const marqueeRect = ref<MarqueeRect | null>(null)
  const suppressSelectionClick = ref(false)
  const isConnectionMode = ref(false)
  const connectionStartNode = ref<string | null>(null)
  const connectionStartSide = ref<ConnectionSide | null>(null)
  const hoveredNodeId = ref<string | null>(null)
  const hoveredNodeSide = ref<ConnectionSide | null>(null)
  const isCommentMode = ref(false)
  const isDownloadMenuOpen = ref(false)
  const isVersionMenuOpen = ref(false)
  const versionHistory = ref<VersionRecord[]>([])
  const currentVersionLabel = ref('')
  const showTeamModal = ref(false)
  const teamMembers = ref<TeamMember[]>([])
  const shareLink = ref('')
  const zoom = ref(1)

  const MIN_ZOOM = 0.25
  const MAX_ZOOM = 2
  const ZOOM_STEP = 0.1
  const BASE_GRID_SIZE = 20
  const selectedNodeId = computed(() =>
    selectedNodeIds.value.length === 1 && selectedEdgeIds.value.length === 0
      ? selectedNodeIds.value[0]
      : null,
  )
  const selectedEdgeId = computed(() =>
    selectedEdgeIds.value.length === 1 && selectedNodeIds.value.length === 0
      ? selectedEdgeIds.value[0]
      : null,
  )

  const selectedObject = computed<SelectedObject>(() => {
    if (selectedNodeIds.value.length === 1 && selectedEdgeIds.value.length === 0 && selectedNodeId.value) {
      const node = diagramStore.nodes.find(item => item.id === selectedNodeId.value)
      if (node) return { type: 'node', data: node }
    }

    if (selectedEdgeIds.value.length === 1 && selectedNodeIds.value.length === 0 && selectedEdgeId.value) {
      const edge = diagramStore.edges.find(item => item.id === selectedEdgeId.value)
      if (edge) return { type: 'edge', data: edge }
    }

    return null
  })

  const showDragHandles = computed(() => selectedEdgeIds.value.length === 1 && selectedNodeIds.value.length === 0)
  const showConnectionHints = computed(() => isConnectionMode.value)
  const zoomPercent = computed(() => Math.round(zoom.value * 100))
  const canvasTransformStyle = computed(() => ({
    transform: `scale(${zoom.value})`,
    transformOrigin: '0 0',
  }))
  const canvasGridStyle = computed(() => {
    const size = BASE_GRID_SIZE * (zoom.value || 1)
    return { backgroundSize: `${size}px ${size}px` }
  })

  function clearSelection(): void {
    selectedNodeIds.value = []
    selectedEdgeIds.value = []
  }

  function selectNode(nodeId: string): void {
    selectedNodeIds.value = [nodeId]
    selectedEdgeIds.value = []
  }

  function toggleNodeSelection(nodeId: string): void {
    if (selectedNodeIds.value.includes(nodeId)) {
      selectedNodeIds.value = selectedNodeIds.value.filter(id => id !== nodeId)
      return
    }

    selectedNodeIds.value = [...selectedNodeIds.value, nodeId]
  }

  function selectEdge(edgeId: string): void {
    selectedEdgeIds.value = [edgeId]
    selectedNodeIds.value = []
  }

  function toggleEdgeSelection(edgeId: string): void {
    if (selectedEdgeIds.value.includes(edgeId)) {
      selectedEdgeIds.value = selectedEdgeIds.value.filter(id => id !== edgeId)
      return
    }

    selectedEdgeIds.value = [...selectedEdgeIds.value, edgeId]
  }

  function setSelectedNodes(nodeIds: string[]): void {
    selectedNodeIds.value = Array.from(new Set(nodeIds))
  }

  function setSelectedEdges(edgeIds: string[]): void {
    selectedEdgeIds.value = Array.from(new Set(edgeIds))
  }

  function setSelection(nodeIds: string[], edgeIds: string[]): void {
    selectedNodeIds.value = Array.from(new Set(nodeIds))
    selectedEdgeIds.value = Array.from(new Set(edgeIds))
  }

  function setDragging(value: boolean): void {
    isDragging.value = value
  }

  function setDraggingBreakpoint(value: boolean): void {
    isDraggingBreakpoint.value = value
  }

  function setDraggingEdgeId(edgeId: string | null): void {
    draggingEdgeId.value = edgeId
  }

  function setPotentialParentId(nodeId: string | null): void {
    potentialParentId.value = nodeId
  }

  function startMarquee(point: Position): void {
    isMarqueeSelecting.value = true
    marqueeStart.value = point
    marqueeCurrent.value = point
    marqueeRect.value = {
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    }
  }

  function updateMarquee(point: Position): void {
    if (!marqueeStart.value) return

    marqueeCurrent.value = point
    marqueeRect.value = {
      x: Math.min(marqueeStart.value.x, point.x),
      y: Math.min(marqueeStart.value.y, point.y),
      width: Math.abs(point.x - marqueeStart.value.x),
      height: Math.abs(point.y - marqueeStart.value.y),
    }
  }

  function finishMarquee(): MarqueeRect | null {
    const rect = marqueeRect.value
    isMarqueeSelecting.value = false
    marqueeStart.value = null
    marqueeCurrent.value = null
    marqueeRect.value = null
    return rect
  }

  function cancelMarquee(): void {
    isMarqueeSelecting.value = false
    marqueeStart.value = null
    marqueeCurrent.value = null
    marqueeRect.value = null
  }

  function suppressSelectionClickOnce(): void {
    suppressSelectionClick.value = true
  }

  function consumeSelectionClickSuppression(): boolean {
    if (!suppressSelectionClick.value) return false
    suppressSelectionClick.value = false
    return true
  }

  function startConnectionMode(): void {
    isConnectionMode.value = true
    connectionStartNode.value = null
    connectionStartSide.value = null
    isCommentMode.value = false
  }

  function resetConnectionMode(): void {
    isConnectionMode.value = false
    connectionStartNode.value = null
    connectionStartSide.value = null
    hoveredNodeId.value = null
    hoveredNodeSide.value = null
  }

  function setConnectionStart(nodeId: string | null, side: ConnectionSide | null): void {
    connectionStartNode.value = nodeId
    connectionStartSide.value = side
  }

  function setHoveredNode(nodeId: string | null, side: ConnectionSide | null): void {
    hoveredNodeId.value = nodeId
    hoveredNodeSide.value = side
  }

  function toggleCommentMode(): void {
    isCommentMode.value = !isCommentMode.value
    if (isCommentMode.value) {
      resetConnectionMode()
    }
  }

  function stopCommentMode(): void {
    isCommentMode.value = false
  }

  function toggleDownloadMenu(): void {
    isVersionMenuOpen.value = false
    isDownloadMenuOpen.value = !isDownloadMenuOpen.value
  }

  function closeDownloadMenu(): void {
    isDownloadMenuOpen.value = false
  }

  function toggleVersionMenu(): void {
    isDownloadMenuOpen.value = false
    isVersionMenuOpen.value = !isVersionMenuOpen.value
  }

  function closeVersionMenu(): void {
    isVersionMenuOpen.value = false
  }

  function pinCurrentVersion(): void {
    const now = new Date()
    const current = currentVersionLabel.value
    const match = current.match(/Версия\s+(\d+)\.(\d+)/)
    let major = 1
    let minor = 0

    if (match) {
      major = Number(match[1]) || 1
      minor = (Number(match[2]) || 0) + 1
    }

    versionHistory.value.unshift({
      id: `v${major}.${minor}-${now.getTime()}`,
      label: currentVersionLabel.value,
      date: `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`,
    })
    currentVersionLabel.value = `Версия ${major}.${minor} - Финальная версия`
  }

  function openVersion(versionId: string): void {
    const version = versionHistory.value.find(item => item.id === versionId)
    if (!version) return
    currentVersionLabel.value = version.label
    closeVersionMenu()
  }

  function setShowTeamModal(value: boolean): void {
    showTeamModal.value = value
  }

  function zoomIn(): void {
    zoom.value = Math.min(MAX_ZOOM, +(zoom.value + ZOOM_STEP).toFixed(2))
  }

  function zoomOut(): void {
    zoom.value = Math.max(MIN_ZOOM, +(zoom.value - ZOOM_STEP).toFixed(2))
  }

  function resetForScheme(): void {
    clearSelection()
    resetConnectionMode()
    isCommentMode.value = false
    isDownloadMenuOpen.value = false
    isVersionMenuOpen.value = false
    isDragging.value = false
    isDraggingBreakpoint.value = false
    draggingEdgeId.value = null
    potentialParentId.value = null
    cancelMarquee()
    suppressSelectionClick.value = false
    zoom.value = 1
  }

  return {
    selectedNodeIds,
    selectedEdgeIds,
    selectedNodeId,
    selectedEdgeId,
    selectedObject,
    isDragging,
    isDraggingBreakpoint,
    draggingEdgeId,
    potentialParentId,
    isMarqueeSelecting,
    marqueeStart,
    marqueeCurrent,
    marqueeRect,
    isConnectionMode,
    connectionStartNode,
    connectionStartSide,
    hoveredNodeId,
    hoveredNodeSide,
    isCommentMode,
    isDownloadMenuOpen,
    isVersionMenuOpen,
    versionHistory,
    currentVersionLabel,
    showTeamModal,
    teamMembers,
    shareLink,
    zoom,
    showDragHandles,
    showConnectionHints,
    zoomPercent,
    canvasTransformStyle,
    canvasGridStyle,
    clearSelection,
    selectNode,
    toggleNodeSelection,
    selectEdge,
    toggleEdgeSelection,
    setSelectedNodes,
    setSelectedEdges,
    setSelection,
    setDragging,
    setDraggingBreakpoint,
    setDraggingEdgeId,
    setPotentialParentId,
    startMarquee,
    updateMarquee,
    finishMarquee,
    cancelMarquee,
    suppressSelectionClickOnce,
    consumeSelectionClickSuppression,
    startConnectionMode,
    resetConnectionMode,
    setConnectionStart,
    setHoveredNode,
    toggleCommentMode,
    stopCommentMode,
    toggleDownloadMenu,
    closeDownloadMenu,
    toggleVersionMenu,
    closeVersionMenu,
    pinCurrentVersion,
    openVersion,
    setShowTeamModal,
    zoomIn,
    zoomOut,
    resetForScheme,
  }
})
