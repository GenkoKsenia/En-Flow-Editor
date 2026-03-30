import { useDiagramStore } from '@/domains/diagram'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'
import type { DataFlow, Edge, Node } from '@/domains/graph'

export function useFlowEditorActions() {
  const diagramStore = useDiagramStore()
  const uiStore = useEditorUiStore()

  function cloneFlows(flows: DataFlow[]): DataFlow[] {
    return flows.map(flow => ({
      ...flow,
      finishBlocks: [...(flow.finishBlocks ?? [])],
    }))
  }

  function releaseSelectionLock(): void {
    uiStore.selectedNodeIds.forEach(nodeId => {
      void diagramStore.endNodeEdit(nodeId)
    })
    uiStore.selectedEdgeIds.forEach(edgeId => {
      void diagramStore.endEdgeEdit(edgeId)
    })
  }

  function addNode(): void {
    const node = diagramStore.addNode()
    void diagramStore.finishNodeCreate(node)
  }

  function addBoundary(): void {
    const node = diagramStore.addBoundary()
    void diagramStore.finishNodeCreate(node)
  }

  function createEdge(edge: Edge): void {
    const createdEdge = diagramStore.addEdge(edge)
    void diagramStore.finishEdgeCreate(createdEdge)
  }

  function clearSelection(): void {
    releaseSelectionLock()
    uiStore.clearSelection()
  }

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
    void (async () => {
      const locked = await diagramStore.beginNodeEdit(nodeId)
      if (!locked) return

      const previousNode = diagramStore.nodes.find(node => node.id === nodeId)
      const affectedEdgeIds = Array.from(
        new Set([
          ...(previousNode?.passThroughEdges ?? []),
          ...(updates.passThroughEdges ?? previousNode?.passThroughEdges ?? []),
        ]),
      )

      diagramStore.updateNode(nodeId, updates)
      diagramStore.maintainPassThroughEdges(nodeId)
      await diagramStore.finishNodeUpdate(nodeId, { affectedEdgeIds })
    })()
  }

  function updateEdge(edgeId: string, updates: Partial<Edge>): void {
    void (async () => {
      const locked = await diagramStore.beginEdgeEdit(edgeId)
      if (!locked) return

      diagramStore.updateEdge(edgeId, updates)
      await diagramStore.finishEdgeUpdate(edgeId)
    })()
  }

  function updateDataFlows(newFlows: DataFlow[]): void {
    void (async () => {
      if (uiStore.selectedNodeIds.length === 1 && uiStore.selectedNodeId) {
        const locked = await diagramStore.beginNodeEdit(uiStore.selectedNodeId)
        if (!locked) return
      }

      const previousFlows = cloneFlows(diagramStore.dataFlows)
      diagramStore.updateDataFlows(newFlows)
      await diagramStore.finishDataFlowsUpdate(previousFlows, cloneFlows(newFlows))
    })()
  }

  function deleteNode(nodeId: string): void {
    const node = diagramStore.nodes.find(item => item.id === nodeId)
    if (!node) return

    const connectedEdges = diagramStore.edges
      .filter(edge => edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId)
      .map(edge => ({ id: edge.id }))
    const remainingPassThroughEdgeIds = (node.passThroughEdges ?? []).filter(
      edgeId => !connectedEdges.some(edge => edge.id === edgeId),
    )

    diagramStore.deleteNode(nodeId)
    diagramStore.refreshParentBorders()
    void diagramStore.finishNodeDelete({ id: node.id }, connectedEdges)
    remainingPassThroughEdgeIds.forEach(edgeId => {
      void diagramStore.finishEdgeUpdate(edgeId)
    })
    void diagramStore.endNodeEdit(node.id)
    uiStore.clearSelection()
  }

  function deleteEdge(edgeId: string): void {
    const edge = diagramStore.edges.find(item => item.id === edgeId)
    if (!edge) return

    diagramStore.deleteEdge(edgeId)
    void diagramStore.finishEdgeDelete({ id: edge.id })
    void diagramStore.endEdgeEdit(edge.id)
    uiStore.clearSelection()
  }

  return {
    addNode,
    addBoundary,
    createEdge,
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
