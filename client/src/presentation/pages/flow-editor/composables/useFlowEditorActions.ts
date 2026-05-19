import { watch } from 'vue'
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

  function sameItems(left: string[] = [], right: string[] = []): boolean {
    return left.length === right.length && left.every((item, index) => item === right[index])
  }

  async function releaseSelectionLock(): Promise<void> {
    await diagramStore.releaseActiveOwnedLockScope()
  }

  function addNode(): void {
    if (diagramStore.isReadOnly) return
    const node = diagramStore.addNode()
    void diagramStore.finishNodeCreate(node)
  }

  function addDatabaseNode(): void {
    if (diagramStore.isReadOnly) return
    const node = diagramStore.addDatabaseNode()
    void diagramStore.finishNodeCreate(node)
  }

  function addBoundary(): void {
    if (diagramStore.isReadOnly) return
    const node = diagramStore.addBoundary()
    void diagramStore.finishNodeCreate(node)
  }

  function createEdge(edge: Edge): void {
    if (diagramStore.isReadOnly) return
    const createdEdge = diagramStore.addEdge(edge)
    void diagramStore.finishEdgeCreate(createdEdge)
  }

  async function clearSelection(): Promise<void> {
    const selectedEdgeIds = [...uiStore.selectedEdgeIds]
    const selectedNodeIds = [...uiStore.selectedNodeIds]

    uiStore.clearSelection()

    await Promise.all(selectedEdgeIds.map(async edgeId => {
      await diagramStore.endEdgeEdit(edgeId)
    }))
    await Promise.all(selectedNodeIds.map(async nodeId => {
      await diagramStore.endNodeEdit(nodeId)
    }))

    await releaseSelectionLock()
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
    if (diagramStore.isReadOnly) return
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

      const normalizedEdgeIds = diagramStore.updateNode(nodeId, updates) ?? []
      diagramStore.maintainPassThroughEdges(nodeId)
      await diagramStore.finishNodeUpdate(nodeId, {
        affectedEdgeIds: Array.from(new Set([...affectedEdgeIds, ...normalizedEdgeIds])),
      })
    })()
  }

  function updateEdge(edgeId: string, updates: Partial<Edge>): void {
    if (diagramStore.isReadOnly) return
    void (async () => {
      const locked = await diagramStore.beginEdgeEdit(edgeId)
      if (!locked) return

      diagramStore.updateEdge(edgeId, updates)
      await diagramStore.finishEdgeUpdate(edgeId)
    })()
  }

  function updateDataFlows(newFlows: DataFlow[]): void {
    if (diagramStore.isReadOnly) return
    void (async () => {
      if (uiStore.selectedNodeIds.length === 1 && uiStore.selectedNodeId) {
        const locked = await diagramStore.beginNodeEdit(uiStore.selectedNodeId)
        if (!locked) return
      }

      const previousFlows = cloneFlows(diagramStore.dataFlows)
      diagramStore.updateDataFlows(newFlows)
      const changedEdgeIds: string[] = []

      diagramStore.edges.forEach(edge => {
        const previousKeys = [...(edge.dataKeys ?? [])]
        diagramStore.updateEdge(edge.id, { dataKeys: previousKeys })
        const nextKeys = [...(edge.dataKeys ?? [])]

        if (!sameItems(previousKeys, nextKeys)) {
          changedEdgeIds.push(edge.id)
        }
      })

      await diagramStore.finishDataFlowsUpdate(previousFlows, cloneFlows(newFlows))
      await Promise.all(changedEdgeIds.map(async edgeId => {
        await diagramStore.finishEdgeUpdate(edgeId)
      }))
    })()
  }

  function deleteNode(nodeId: string): void {
    if (diagramStore.isReadOnly) return
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
    if (diagramStore.isReadOnly) return
    const edge = diagramStore.edges.find(item => item.id === edgeId)
    if (!edge) return

    diagramStore.deleteEdge(edgeId)
    void diagramStore.finishEdgeDelete({ id: edge.id })
    void diagramStore.endEdgeEdit(edge.id)
    uiStore.clearSelection()
  }

  watch(
    () => [uiStore.selectedNodeIds.length, uiStore.selectedEdgeIds.length] as const,
    ([nodeCount, edgeCount], [previousNodeCount, previousEdgeCount]) => {
      if (nodeCount !== 0 || edgeCount !== 0) return
      if (previousNodeCount === 0 && previousEdgeCount === 0) return

      void releaseSelectionLock()
    },
  )

  watch(
    () => ({
      nodeIds: [...uiStore.selectedNodeIds],
      edgeIds: [...uiStore.selectedEdgeIds],
    }),
    (nextSelection, previousSelection) => {
      const releasedNodeIds = previousSelection.nodeIds.filter(nodeId => !nextSelection.nodeIds.includes(nodeId))
      const releasedEdgeIds = previousSelection.edgeIds.filter(edgeId => !nextSelection.edgeIds.includes(edgeId))

      if (releasedNodeIds.length === 0 && releasedEdgeIds.length === 0) {
        return
      }

      void Promise.all([
        ...releasedEdgeIds.map(async edgeId => {
          await diagramStore.endEdgeEdit(edgeId)
        }),
        ...releasedNodeIds.map(async nodeId => {
          await diagramStore.endNodeEdit(nodeId)
        }),
      ])
    },
  )

  return {
    addNode,
    addDatabaseNode,
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
