import { computed, type Ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useDiagramCollaborationStore, useDiagramStore } from '@/domains/diagram'
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
  const uiStore = useEditorUiStore()

  const { nodes, edges, dataFlows } = storeToRefs(diagramStore)
  const {
    selectedNodeIds,
    selectedEdgeIds,
    selectedObject,
    selectedNodeId,
    selectedEdgeId,
    isDragging,
    isDraggingBreakpoint,
    draggingEdgeId,
    potentialParentId,
    isConnectionMode,
    isCommentMode,
    isMarqueeSelecting,
    marqueeRect,
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
    edges,
    selectedNodeIds,
    selectedEdgeIds,
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
    if (!sourceNode || !targetNode) return x

    const sourceRect = getNodeRect(sourceNode)
    const targetRect = getNodeRect(targetNode)

    if (edge.sourceSide === 'left' && edge.targetSide === 'left') {
      const minX = Math.min(sourceRect.left, targetRect.left) - 200
      const maxX = Math.min(sourceRect.left, targetRect.left) - 20
      return Math.max(minX, Math.min(maxX, x))
    }

    if (edge.sourceSide === 'right' && edge.targetSide === 'right') {
      const minX = Math.max(sourceRect.right, targetRect.right) + 20
      const maxX = Math.max(sourceRect.right, targetRect.right) + 200
      return Math.max(minX, Math.min(maxX, x))
    }

    const minX = Math.min(sourceRect.left, targetRect.left) + 10
    const maxX = Math.max(sourceRect.right, targetRect.right) - 10

    return Math.max(minX, Math.min(maxX, x))
  }

  const clampYValue = (edge: Edge, y: number) => {
    const sourceNode = nodes.value.find(node => node.id === edge.sourceNodeId)
    const targetNode = nodes.value.find(node => node.id === edge.targetNodeId)
    if (!sourceNode || !targetNode) return y

    const sourceRect = getNodeRect(sourceNode)
    const targetRect = getNodeRect(targetNode)

    if (edge.sourceSide === 'top' && edge.targetSide === 'top') {
      const minY = Math.min(sourceRect.top, targetRect.top) - 200
      const maxY = Math.min(sourceRect.top, targetRect.top) - 20
      return Math.max(minY, Math.min(maxY, y))
    }

    if (edge.sourceSide === 'bottom' && edge.targetSide === 'bottom') {
      const minY = Math.max(sourceRect.bottom, targetRect.bottom) + 20
      const maxY = Math.max(sourceRect.bottom, targetRect.bottom) + 200
      return Math.max(minY, Math.min(maxY, y))
    }

    const minY = Math.min(sourceRect.top, targetRect.top) + 10
    const maxY = Math.max(sourceRect.bottom, targetRect.bottom) - 10

    return Math.max(minY, Math.min(maxY, y))
  }

  const { startCommentDrag } = useCommentDrag({
    comments: commentsApi.comments,
    zoom,
    documentStore: commentsApi,
  })

  const { onBreakpointDragStart } = useBreakpointDrag({
    nodes,
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

  function getCanvasPoint(event: MouseEvent): { x: number; y: number } | null {
    if (!canvasContent.value) return null

    const rect = canvasContent.value.getBoundingClientRect()
    const styles = window.getComputedStyle(canvasContent.value)
    const paddingLeft = Number.parseFloat(styles.paddingLeft || '0') || 0
    const paddingTop = Number.parseFloat(styles.paddingTop || '0') || 0
    const scale = zoom.value || 1

    return {
      x: (event.clientX - rect.left) / scale - paddingLeft,
      y: (event.clientY - rect.top) / scale - paddingTop,
    }
  }

  function rectsIntersect(
    first: { x: number; y: number; width: number; height: number },
    second: { left: number; top: number; width: number; height: number },
  ): boolean {
    return !(
      first.x + first.width < second.left ||
      second.left + second.width < first.x ||
      first.y + first.height < second.top ||
      second.top + second.height < first.y
    )
  }

  function onCanvasMouseDown(event: MouseEvent): void {
    if (isConnectionMode.value || isCommentMode.value) return

    const target = event.target as Element | null
    if (
      target?.closest('.node') ||
      target?.closest('.edge') ||
      target?.closest('.lock-badge') ||
      target?.closest('.comment-bubble') ||
      target?.closest('.canvas-zoom-controls') ||
      target?.closest('.properties-panel') ||
      target?.closest('.diagnostics-panel')
    ) {
      return
    }

    const start = getCanvasPoint(event)
    if (!start) return

    void actions.clearSelection()
    uiStore.startMarquee(start)

    const onMouseMove = (moveEvent: MouseEvent) => {
      const point = getCanvasPoint(moveEvent)
      if (!point) return
      uiStore.updateMarquee(point)
    }

    const onMouseUp = () => {
      const rect = uiStore.finishMarquee()
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)

      if (!rect || (rect.width < 4 && rect.height < 4)) {
        return
      }

      const selectedNodes = nodes.value
        .filter(node => rectsIntersect(rect, getNodeRect(node)))
        .map(node => node.id)
      const selectedNodeSet = new Set(selectedNodes)
      const selectedEdges = edges.value
        .filter(edge => selectedNodeSet.has(edge.sourceNodeId) && selectedNodeSet.has(edge.targetNodeId))
        .map(edge => edge.id)

      uiStore.setSelection(selectedNodes, selectedEdges)
      uiStore.suppressSelectionClickOnce()
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    event.preventDefault()
  }

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
    comments: commentsApi.comments,
    selectedObject,
    selectedNodeIds,
    selectedEdgeIds,
    selectedNodeId,
    selectedEdgeId,
    isMarqueeSelecting,
    marqueeRect,
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
    zoom,
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
    schemeDiagnostics: diagnostics.schemeDiagnostics,
    nodeSendableData: diagnostics.nodeSendableData,
    isConnectionSource: connections.isConnectionSource,
    isConnectionTarget: connections.isConnectionTarget,
    getChildrenCount,
    getConnectionPosition,
    getCommentStyle: commentsApi.getCommentStyle,
    canEditComment: commentsApi.canEditComment,
    showCommentActions: commentsApi.showCommentActions,
    canResolveComment: commentsApi.canResolveComment,
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
    onCanvasMouseDown,
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
    cancelComment: commentsApi.cancelComment,
    deleteComment: commentsApi.deleteComment,
    isCommentResolved: commentsApi.isCommentResolved,
    toggleCommentResolved: commentsApi.toggleCommentResolved,
    canDeleteComment: commentsApi.canDeleteComment,
    zoomIn: viewport.zoomIn,
    zoomOut: viewport.zoomOut,
  }
}
