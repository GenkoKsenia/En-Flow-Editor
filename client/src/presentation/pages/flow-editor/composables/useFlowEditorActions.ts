import { watch } from 'vue'
import { useDiagramStore } from '@/domains/diagram'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'
import type { DataFlow, Edge, Node } from '@/domains/graph'

type DiagramClipboard = {
  nodes: Node[]
  edges: Edge[]
  dataFlows: DataFlow[]
  pasteCount: number
}

let clipboard: DiagramClipboard | null = null

export function useFlowEditorActions() {
  const diagramStore = useDiagramStore()
  const uiStore = useEditorUiStore()

  function cloneNode(node: Node): Node {
    return {
      ...node,
      position: { ...node.position },
      passThroughEdges: [...(node.passThroughEdges ?? [])],
      meta: node.meta && typeof node.meta === 'object' ? { ...node.meta } : node.meta,
      informationIds: [...(node.informationIds ?? [])],
    }
  }

  function cloneFlows(flows: DataFlow[]): DataFlow[] {
    return flows.map(flow => ({
      ...flow,
      finishBlocks: [...(flow.finishBlocks ?? [])],
    }))
  }

  function cloneEdge(edge: Edge): Edge {
    return {
      ...edge,
      labelPosition: edge.labelPosition,
      dataKeys: [...(edge.dataKeys ?? [])],
      breakpoints: edge.breakpoints?.map(point => ({ x: point.x, y: point.y })),
    }
  }

  function sameItems(left: string[] = [], right: string[] = []): boolean {
    return left.length === right.length && left.every((item, index) => item === right[index])
  }

  function createCopiedNodeId(sourceId: string): string {
    if (sourceId.startsWith('boundary-')) {
      const id = `boundary-${diagramStore.nextBoundaryId}`
      diagramStore.nextBoundaryId += 1
      return id
    }

    const id = `node-${diagramStore.nextNodeId}`
    diagramStore.nextNodeId += 1
    return id
  }

  function createCopiedDataKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `data-${crypto.randomUUID()}`
    }

    return `data-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  function getExpandableSelectedNodeIds(nodeIds: string[]): string[] {
    const expanded = new Set<string>()

    nodeIds.forEach(nodeId => {
      expanded.add(nodeId)
      diagramStore.getDescendantNodes(nodeId).forEach(node => {
        expanded.add(node.id)
      })
    })

    return Array.from(expanded)
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

  function copySelection(): void {
    const selectedNodeIds = getExpandableSelectedNodeIds(uiStore.selectedNodeIds)
    const selectedNodeSet = new Set(selectedNodeIds)

    const nodes = selectedNodeIds
      .map(nodeId => diagramStore.nodes.find(node => node.id === nodeId))
      .filter((node): node is Node => Boolean(node))
      .map(cloneNode)

    const edges = uiStore.selectedEdgeIds
      .map(edgeId => diagramStore.edges.find(edge => edge.id === edgeId))
      .filter((edge): edge is Edge => Boolean(edge))
      .filter(edge => selectedNodeSet.has(edge.sourceNodeId) && selectedNodeSet.has(edge.targetNodeId))
      .map(cloneEdge)

    const dataFlows = cloneFlows(
      diagramStore.dataFlows.filter(flow => flow.startBlock && selectedNodeSet.has(flow.startBlock)),
    )

    if (!nodes.length && !edges.length) {
      clipboard = null
      return
    }

    clipboard = {
      nodes,
      edges,
      dataFlows,
      pasteCount: 0,
    }
  }

  function pasteSelection(): void {
    if (diagramStore.isReadOnly || !clipboard) return
    if (!clipboard.nodes.length) return

    void (async () => {
      diagramStore.beginHistoryBatch()
      try {
        const source = clipboard
        const offset = 24 * (source.pasteCount + 1)
        const previousFlows = cloneFlows(diagramStore.dataFlows)
        const nodeIdMap = new Map<string, string>()
        const dataKeyMap = new Map<string, string>()
        const sourceNodesById = new Map(source.nodes.map(node => [node.id, node]))

        source.nodes.forEach(node => {
          nodeIdMap.set(node.id, createCopiedNodeId(node.id))
        })
        source.dataFlows.forEach(flow => {
          dataKeyMap.set(flow.dataKey, createCopiedDataKey())
        })

        const pastedNodes = source.nodes.map(node => ({
          ...cloneNode(node),
          id: nodeIdMap.get(node.id) ?? node.id,
          position: {
            x: node.position.x + offset,
            y: node.position.y + offset,
          },
          parentId: node.parentId ? (nodeIdMap.get(node.parentId) ?? node.parentId) : undefined,
          passThroughEdges: [],
          informationIds: (node.informationIds ?? []).map(dataKey => dataKeyMap.get(dataKey) ?? dataKey),
        }))

        const pastedEdges = source.edges
          .filter(edge => nodeIdMap.has(edge.sourceNodeId) && nodeIdMap.has(edge.targetNodeId))
          .map(edge => ({
            ...cloneEdge(edge),
            id: diagramStore.createEdgeId(),
            sourceNodeId: nodeIdMap.get(edge.sourceNodeId) ?? edge.sourceNodeId,
            targetNodeId: nodeIdMap.get(edge.targetNodeId) ?? edge.targetNodeId,
            breakpoints: edge.breakpoints?.map(point => ({
              x: point.x + offset,
              y: point.y + offset,
            })),
            breakpointX: typeof edge.breakpointX === 'number' ? edge.breakpointX + offset : edge.breakpointX,
            breakpointY: typeof edge.breakpointY === 'number' ? edge.breakpointY + offset : edge.breakpointY,
            dataKeys: (edge.dataKeys ?? []).map(dataKey => dataKeyMap.get(dataKey) ?? dataKey),
          }))

        const edgeIdMap = new Map(source.edges.map((edge, index) => [edge.id, pastedEdges[index]?.id]))
        pastedNodes.forEach(node => {
          const sourceNodeId = Array.from(nodeIdMap.entries()).find(([, value]) => value === node.id)?.[0]
          node.passThroughEdges = (sourceNodeId ? sourceNodesById.get(sourceNodeId)?.passThroughEdges : [])
            .map(edgeId => edgeIdMap.get(edgeId))
            .filter((edgeId): edgeId is string => Boolean(edgeId))
        })

        const pastedFlows = source.dataFlows.map(flow => ({
          ...flow,
          dataKey: dataKeyMap.get(flow.dataKey) ?? flow.dataKey,
          startBlock: flow.startBlock ? (nodeIdMap.get(flow.startBlock) ?? flow.startBlock) : undefined,
          finishBlocks: (flow.finishBlocks ?? []).map(blockId => nodeIdMap.get(blockId) ?? blockId),
        }))

        pastedNodes.forEach(node => {
          diagramStore.nodes.push(node)
        })
        pastedEdges.forEach(edge => {
          diagramStore.addEdge(edge)
        })

        diagramStore.updateDataFlows([...diagramStore.dataFlows, ...pastedFlows])
        pastedEdges.forEach(edge => {
          diagramStore.updateEdge(edge.id, { dataKeys: [...(edge.dataKeys ?? [])] })
        })

        const affectedParentIds = Array.from(new Set(
          pastedNodes
            .map(node => node.parentId)
            .filter((parentId): parentId is string => Boolean(parentId)),
        ))
        affectedParentIds.forEach(parentId => {
          diagramStore.ensureParentPadding(parentId)
        })
        diagramStore.refreshParentBorders()
        pastedNodes.forEach(node => {
          diagramStore.maintainPassThroughEdges(node.id)
        })

        uiStore.setSelection(
          pastedNodes.map(node => node.id),
          pastedEdges.map(edge => edge.id),
        )

        await Promise.all(pastedNodes.map(async node => {
          await diagramStore.finishNodeCreate(node)
        }))
        if (pastedFlows.length) {
          await diagramStore.finishDataFlowsUpdate(previousFlows, cloneFlows(diagramStore.dataFlows))
        }
        await Promise.all(pastedEdges.map(async edge => {
          await diagramStore.finishEdgeCreate(edge)
        }))

        clipboard = {
          ...source,
          pasteCount: source.pasteCount + 1,
        }
      } finally {
        diagramStore.endHistoryBatch()
      }
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

  function deleteSelection(): void {
    if (diagramStore.isReadOnly) return

    diagramStore.beginHistoryBatch()
    const nodeIds = getExpandableSelectedNodeIds(uiStore.selectedNodeIds)
    const nodeIdSet = new Set(nodeIds)
    const edgeIds = Array.from(new Set(
      uiStore.selectedEdgeIds.filter(edgeId => {
        const edge = diagramStore.edges.find(item => item.id === edgeId)
        if (!edge) return false
        return !nodeIdSet.has(edge.sourceNodeId) && !nodeIdSet.has(edge.targetNodeId)
      }),
    ))

    nodeIds.forEach(nodeId => {
      deleteNode(nodeId)
    })
    edgeIds.forEach(edgeId => {
      deleteEdge(edgeId)
    })
    diagramStore.endHistoryBatch()
  }

  async function undo(): Promise<void> {
    if (diagramStore.isReadOnly) return
    await clearSelection()
    diagramStore.undoHistory()
  }

  async function redo(): Promise<void> {
    if (diagramStore.isReadOnly) return
    await clearSelection()
    diagramStore.redoHistory()
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
    copySelection,
    pasteSelection,
    deleteSelection,
    undo,
    redo,
    deleteNode,
    deleteEdge,
  }
}
