import { useEditorDocumentStore, useEditorUiStore } from '@/stores'
import type { DataFlow, Edge, Node } from '@/models'

export function useFlowEditorActions() {
  const documentStore = useEditorDocumentStore()
  const uiStore = useEditorUiStore()

  const addNode = () => documentStore.addNode()
  const addBoundary = () => documentStore.addBoundary()
  const clearSelection = () => uiStore.clearSelection()
  const toggleCommentMode = () => uiStore.toggleCommentMode()
  const openTeamModal = () => uiStore.setShowTeamModal(true)
  const closeTeamModal = () => uiStore.setShowTeamModal(false)
  const toggleVersionMenu = () => uiStore.toggleVersionMenu()
  const closeVersionMenu = () => uiStore.closeVersionMenu()
  const pinCurrentVersion = () => uiStore.pinCurrentVersion()
  const openVersion = (versionId: string) => uiStore.openVersion(versionId)
  const setCurrentVersionLabel = (value: string) => {
    uiStore.currentVersionLabel = value
  }
  const toggleDownloadMenu = () => uiStore.toggleDownloadMenu()
  const closeDownloadMenu = () => uiStore.closeDownloadMenu()

  function updateNode(nodeId: string, updates: Partial<Node>): void {
    documentStore.updateNode(nodeId, updates)
    documentStore.maintainPassThroughEdges(nodeId)
  }

  function updateEdge(edgeId: string, updates: Partial<Edge>): void {
    documentStore.updateEdge(edgeId, updates)
  }

  function updateDataFlows(newFlows: DataFlow[]): void {
    documentStore.updateDataFlows(newFlows)
  }

  function deleteNode(nodeId: string): void {
    documentStore.deleteNode(nodeId)
    documentStore.refreshParentBorders()
    uiStore.clearSelection()
  }

  function deleteEdge(edgeId: string): void {
    documentStore.deleteEdge(edgeId)
    uiStore.clearSelection()
  }

  return {
    addNode,
    addBoundary,
    clearSelection,
    toggleCommentMode,
    openTeamModal,
    closeTeamModal,
    toggleVersionMenu,
    closeVersionMenu,
    pinCurrentVersion,
    openVersion,
    setCurrentVersionLabel,
    toggleDownloadMenu,
    closeDownloadMenu,
    updateNode,
    updateEdge,
    updateDataFlows,
    deleteNode,
    deleteEdge,
  }
}
