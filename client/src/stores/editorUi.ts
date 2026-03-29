import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  createMockTeamMembers,
  createMockVersionHistory,
  MOCK_CURRENT_VERSION_LABEL,
  MOCK_SHARE_LINK,
} from '@/mocks'
import type { ConnectionSide, SelectedObject, TeamMember, VersionRecord } from '@/models'
import { useEditorDocumentStore } from './editorDocument'

export const useEditorUiStore = defineStore('editorUi', () => {
  const documentStore = useEditorDocumentStore()

  const selectedNodeId = ref<string | null>(null)
  const selectedEdgeId = ref<string | null>(null)
  const isDragging = ref(false)
  const isDraggingBreakpoint = ref(false)
  const draggingEdgeId = ref<string | null>(null)
  const potentialParentId = ref<string | null>(null)
  const isConnectionMode = ref(false)
  const connectionStartNode = ref<string | null>(null)
  const connectionStartSide = ref<ConnectionSide | null>(null)
  const hoveredNodeId = ref<string | null>(null)
  const hoveredNodeSide = ref<ConnectionSide | null>(null)
  const isCommentMode = ref(false)
  const isDownloadMenuOpen = ref(false)
  const isVersionMenuOpen = ref(false)
  const versionHistory = ref<VersionRecord[]>(createMockVersionHistory())
  const currentVersionLabel = ref(MOCK_CURRENT_VERSION_LABEL)
  const showTeamModal = ref(false)
  const teamMembers = ref<TeamMember[]>(createMockTeamMembers())
  const shareLink = ref(MOCK_SHARE_LINK)
  const zoom = ref(1)

  const MIN_ZOOM = 0.25
  const MAX_ZOOM = 2
  const ZOOM_STEP = 0.1
  const BASE_GRID_SIZE = 20

  const selectedObject = computed<SelectedObject>(() => {
    if (selectedNodeId.value) {
      const node = documentStore.nodes.find(item => item.id === selectedNodeId.value)
      if (node) return { type: 'node', data: node }
    }

    if (selectedEdgeId.value) {
      const edge = documentStore.edges.find(item => item.id === selectedEdgeId.value)
      if (edge) return { type: 'edge', data: edge }
    }

    return null
  })

  const showDragHandles = computed(() => selectedEdgeId.value !== null)
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
    selectedNodeId.value = null
    selectedEdgeId.value = null
  }

  function selectNode(nodeId: string): void {
    selectedNodeId.value = nodeId
    selectedEdgeId.value = null
  }

  function selectEdge(edgeId: string): void {
    selectedEdgeId.value = edgeId
    selectedNodeId.value = null
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
    zoom.value = 1
  }

  return {
    selectedNodeId,
    selectedEdgeId,
    selectedObject,
    isDragging,
    isDraggingBreakpoint,
    draggingEdgeId,
    potentialParentId,
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
    selectEdge,
    setDragging,
    setDraggingBreakpoint,
    setDraggingEdgeId,
    setPotentialParentId,
    startConnectionMode,
    resetConnectionMode,
    setConnectionStart,
    setHoveredNode,
    toggleCommentMode,
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
