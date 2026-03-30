import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useCommentsStore } from '@/domains/comments'
import { clampBreakpointX, clampBreakpointY, useDiagramCollaborationStore, useDiagramStore } from '@/domains/diagram'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'
import type { Edge, Node } from '@/domains/graph'

import { useBreakpointDrag } from './useBreakpointDrag'
import { useCommentDrag } from './useCommentDrag'
import { useEditorDiagnostics } from './useEditorDiagnostics'
import { useFlowEditorActions } from './useFlowEditorActions'
import { useFlowEditorComments } from './useFlowEditorComments'
import { useFlowEditorConnections } from './useFlowEditorConnections'
import { useFlowGraphView } from './useFlowGraphView'
import { useNodeDrag } from './useNodeDrag'
import { useFlowEditorViewport } from './useFlowEditorViewport'

const CONTAINER_PADDING = 24

export function useFlowEditorWorkspace(
  canvas: Ref<HTMLElement | null>,
  canvasContent: Ref<HTMLElement | null>,
) {
  const diagramStore = useDiagramStore()
  const collaborationStore = useDiagramCollaborationStore()
  const commentsStore = useCommentsStore()
  const uiStore = useEditorUiStore()

  const { nodes, edges, dataFlows } = storeToRefs(diagramStore)
  const { comments } = storeToRefs(commentsStore)
  const {
    selectedObject,
    selectedNodeId,
    selectedEdgeId,
    isDragging,
    isDraggingBreakpoint,
    draggingEdgeId,
    potentialParentId,
    isConnectionMode,
    isCommentMode,
    isDownloadMenuOpen,
    isVersionMenuOpen,
    versionHistory,
    currentVersionLabel,
    zoom,
    showDragHandles,
    showConnectionHints,
    zoomPercent,
    canvasTransformStyle,
    canvasGridStyle,
  } = storeToRefs(uiStore)

  const actions = useFlowEditorActions()
  const viewport = useFlowEditorViewport()

  const getAbsoluteNodePosition = (node: Node) => diagramStore.getAbsoluteNodePosition(node)
  const getNodeRect = (node: Node) => diagramStore.getNodeRect(node)

  const {
    getConnectionPosition,
    doesEdgePassThroughNode,
    getChildrenCount,
    getEdgeAnchor,
  } = useFlowGraphView({
    nodes,
    edges,
    getAbsoluteNodePosition,
    getNodeRect,
  })

  const diagnostics = useEditorDiagnostics({
    nodes,
    edges,
    dataFlows,
    isDraggingBreakpoint,
    doesEdgePassThroughNode,
    maintainPassThroughEdges: diagramStore.maintainPassThroughEdges,
  })

  const commentsApi = useFlowEditorComments({
    canvasContent,
    getNodeRect,
    getEdgeAnchor,
  })

  const connections = useFlowEditorConnections({
    nodeSendableData: diagnostics.nodeSendableData,
    addCommentForNode: commentsApi.addCommentForNode,
    addCommentForEdge: commentsApi.addCommentForEdge,
    addCommentOnCanvas: commentsApi.addCommentOnCanvas,
    createEdge: actions.createEdge,
    clearSelection: actions.clearSelection,
  })

  const { onNodeMouseDown } = useNodeDrag({
    nodes,
    zoom,
    isConnectionMode,
    isCommentMode,
    documentStore: diagramStore,
    uiStore,
    containerPadding: CONTAINER_PADDING,
  })

  const clampXValue = (edge: Edge, x: number) => {
    const sourceNode = nodes.value.find(node => node.id === edge.sourceNodeId)
    const targetNode = nodes.value.find(node => node.id === edge.targetNodeId)
    return !sourceNode || !targetNode ? x : clampBreakpointX(edge, sourceNode, targetNode, x)
  }

  const clampYValue = (edge: Edge, y: number) => {
    const sourceNode = nodes.value.find(node => node.id === edge.sourceNodeId)
    const targetNode = nodes.value.find(node => node.id === edge.targetNodeId)
    return !sourceNode || !targetNode ? y : clampBreakpointY(edge, sourceNode, targetNode, y)
  }

  const { startCommentDrag } = useCommentDrag({
    comments,
    zoom,
    documentStore: commentsStore,
  })

  const { onBreakpointDragStart } = useBreakpointDrag({
    edges,
    isDraggingBreakpoint,
    draggingEdgeId,
    zoom,
    canvas: computed(() => canvas.value),
    uiStore,
    diagramStore,
    clampXValue,
    clampYValue,
  })

  const lockedNodeOwners = computed<Record<string, string | null>>(() =>
    Object.fromEntries(
      nodes.value.map(node => [node.id, collaborationStore.getElementLockOwner('block', node.id)]),
    ),
  )
  const lockedEdgeOwners = computed<Record<string, string | null>>(() =>
    Object.fromEntries(
      edges.value.map(edge => [edge.id, collaborationStore.getElementLockOwner('connection', edge.id)]),
    ),
  )
  const selectedObjectLockOwner = computed(() => {
    if (selectedNodeId.value) {
      return collaborationStore.getElementLockOwner('block', selectedNodeId.value)
    }

    if (selectedEdgeId.value) {
      return collaborationStore.getElementLockOwner('connection', selectedEdgeId.value)
    }

    return null
  })
  const isSelectedObjectLockedByOther = computed(() =>
    selectedObjectLockOwner.value !== null && selectedObjectLockOwner.value !== 'self',
  )
  const selectedObjectLockMessage = computed(() => {
    if (!isSelectedObjectLockedByOther.value) return null
    return selectedObjectLockOwner.value === 'locked'
      ? 'Элемент занят другим пользователем'
      : `Элемент занят: ${selectedObjectLockOwner.value}`
  })

  return {
    nodes,
    edges,
    dataFlows,
    comments,
    selectedObject,
    selectedNodeId,
    selectedEdgeId,
    lockedNodeOwners,
    lockedEdgeOwners,
    isSelectedObjectLockedByOther,
    selectedObjectLockMessage,
    isDragging,
    potentialParentId,
    isConnectionMode,
    isCommentMode,
    isDownloadMenuOpen,
    isVersionMenuOpen,
    versionHistory,
    currentVersionLabel,
    showDragHandles,
    showConnectionHints,
    zoomPercent,
    canvasTransformStyle,
    canvasGridStyle,
    edgeRequiresPassThrough: diagnostics.edgeRequiresPassThrough,
    edgePassThroughErrors: diagnostics.edgePassThroughErrors,
    edgeErrorMessages: diagnostics.edgeErrorMessages,
    edgeWarningMessages: diagnostics.edgeWarningMessages,
    nodePassThroughErrors: diagnostics.nodePassThroughErrors,
    nodeDataErrors: diagnostics.nodeDataErrors,
    nodeMissingTarget: diagnostics.nodeMissingTarget,
    nodeForbiddenOutgoing: diagnostics.nodeForbiddenOutgoing,
    nodeErrorMessages: diagnostics.nodeErrorMessages,
    nodeWarningMessages: diagnostics.nodeWarningMessages,
    nodeSendableData: diagnostics.nodeSendableData,
    isConnectionSource: connections.isConnectionSource,
    isConnectionTarget: connections.isConnectionTarget,
    getChildrenCount,
    getConnectionPosition,
    getCommentStyle: commentsApi.getCommentStyle,
    getAbsoluteNodePosition,
    addNode: actions.addNode,
    startConnectionMode: connections.startConnectionMode,
    toggleCommentMode: actions.toggleCommentMode,
    addBoundary: actions.addBoundary,
    openTeamModal: actions.openTeamModal,
    toggleVersionMenu: actions.toggleVersionMenu,
    pinCurrentVersion: actions.pinCurrentVersion,
    openVersion: actions.openVersion,
    setCurrentVersionLabel: actions.setCurrentVersionLabel,
    toggleDownloadMenu: actions.toggleDownloadMenu,
    closeDownloadMenu: actions.closeDownloadMenu,
    closeVersionMenu: actions.closeVersionMenu,
    updateNode: actions.updateNode,
    updateEdge: actions.updateEdge,
    updateDataFlows: actions.updateDataFlows,
    deleteNode: actions.deleteNode,
    deleteEdge: actions.deleteEdge,
    clearSelection: actions.clearSelection,
    onCanvasClick: connections.onCanvasClick,
    onCanvasWheel: viewport.onCanvasWheel,
    onEdgeClick: connections.onEdgeClick,
    onBreakpointDragStart,
    onNodeMouseDown,
    onNodeClick: connections.onNodeClick,
    onNodeHoverSide: connections.onNodeHoverSide,
    startCommentDrag,
    updateCommentText: commentsApi.updateCommentText,
    submitComment: commentsApi.submitComment,
    removeComment: commentsApi.discardComment,
    zoomIn: viewport.zoomIn,
    zoomOut: viewport.zoomOut,
  }
}
