import { computed, type ComputedRef } from 'vue'
import { storeToRefs } from 'pinia'

import {
  buildOrthogonalConnectorCorners,
  getNodeConnectionPoint,
  getSideAxis,
  projectOrthogonalPoint,
  roundCoord,
  sanitizeOrthogonalCorners,
  toggleSegmentAxis,
  useDiagramStore,
} from '@/domains/diagram'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'
import {
  getAllowedConnectionSidesForBorderStyle,
  normalizeConnectionSideForBorderStyle,
  type ConnectionSide,
  type Edge,
  type Node,
  type Position,
} from '@/domains/graph'

type UseFlowEditorConnectionsOptions = {
  nodeSendableData: ComputedRef<Record<string, string[]>>
  addCommentForNode: (nodeId: string) => boolean
  addCommentForEdge: (edgeId: string) => boolean
  addCommentOnCanvas: (event: MouseEvent) => boolean
  createEdge: (edge: Edge) => void
  clearSelection: () => Promise<void> | void
  getCanvasPoint: (event: MouseEvent) => Position | null
  getAbsoluteNodePosition: (node: Node) => Position
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
  getCanvasPoint,
  getAbsoluteNodePosition,
}: UseFlowEditorConnectionsOptions) {
  const documentStore = useDiagramStore()
  const uiStore = useEditorUiStore()

  const { nodes, edges, isReadOnly } = storeToRefs(documentStore)
  const {
    isCommentMode,
    isConnectionMode,
    connectionStartNode,
    connectionStartSide,
    connectionDraftPoints,
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

  const connectionDraftPath = computed(() => {
    if (!connectionStartNode.value || !connectionStartSide.value || !connectionDraftPoints.value.length) {
      return ''
    }

    const sourceNode = nodes.value.find(node => node.id === connectionStartNode.value)
    if (!sourceNode) return ''

    const startPoint = getNodeConnectionPoint(
      getAbsoluteNodePosition(sourceNode),
      sourceNode,
      connectionStartSide.value,
    )

    const points = sanitizeOrthogonalCorners(connectionDraftPoints.value)
    if (!points.length) return ''

    let path = `M ${startPoint.x} ${startPoint.y}`
    points.forEach(point => {
      path += ` L ${point.x} ${point.y}`
    })

    return path
  })

  const startConnectionMode = () => {
    if (isReadOnly.value) return
    uiStore.startConnectionMode()
  }
  const resetConnectionMode = () => uiStore.resetConnectionMode()

  function getClickedNodeSide(node: Node, event: MouseEvent): ConnectionSide {
    const target = event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : null
    const allowedSides = getAllowedConnectionSidesForBorderStyle(node.borderStyle)

    if (!target || !allowedSides.length) {
      return allowedSides[0] ?? 'right'
    }

    const rect = target.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    return allowedSides
      .map(side => ({
        side,
        distance: side === 'top'
          ? y
          : side === 'right'
            ? rect.width - x
            : side === 'bottom'
              ? rect.height - y
              : x,
      }))
      .sort((left, right) => left.distance - right.distance)[0]?.side ?? 'right'
  }

  function getConnectionPointForNode(nodeId: string, side: ConnectionSide): Position | null {
    const node = nodes.value.find(item => item.id === nodeId)
    if (!node) return null

    return getNodeConnectionPoint(getAbsoluteNodePosition(node), node, side)
  }

  function getDraftAxis(): ReturnType<typeof getSideAxis> | null {
    if (!connectionStartSide.value) return null

    let axis = getSideAxis(connectionStartSide.value)
    for (let index = 0; index < connectionDraftPoints.value.length; index += 1) {
      axis = toggleSegmentAxis(axis)
    }

    return axis
  }

  function buildConnectionBreakpoints(
    sourceId: string,
    sourceSide: ConnectionSide,
    targetId: string,
    targetSide: ConnectionSide,
  ): Position[] {
    const sourcePoint = getConnectionPointForNode(sourceId, sourceSide)
    const targetPoint = getConnectionPointForNode(targetId, targetSide)
    if (!sourcePoint || !targetPoint) {
      return []
    }

    const points = sanitizeOrthogonalCorners(connectionDraftPoints.value)
    if (!points.length) {
      return []
    }

    const currentPoint = points[points.length - 1] ?? sourcePoint
    const nextAxis = getDraftAxis()
    if (!nextAxis) {
      return points
    }

    return sanitizeOrthogonalCorners([
      ...points,
      ...buildOrthogonalConnectorCorners(
        currentPoint,
        targetPoint,
        nextAxis,
        getSideAxis(targetSide),
      ),
    ])
  }

  function buildPendingEdge(
    sourceId: string,
    sourceSide: ConnectionSide,
    targetId: string,
    targetSide: ConnectionSide,
    breakpoints: Position[] = [],
  ) {
    return {
      id: documentStore.createEdgeId(),
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      sourceSide,
      targetSide,
      breakpoints,
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
    const breakpoints = buildConnectionBreakpoints(
      sourceId,
      normalizedSourceSide,
      targetId,
      normalizedTargetSide,
    )

    createEdge({
      ...buildPendingEdge(
        sourceId,
        normalizedSourceSide,
        targetId,
        normalizedTargetSide,
        breakpoints,
      ),
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

    const node = nodes.value.find(item => item.id === nodeId)
    if (!node) return

    const resolvedSide = hoveredNodeId.value === nodeId && hoveredNodeSide.value
      ? hoveredNodeSide.value
      : getClickedNodeSide(node, event)

    if (!connectionStartNode.value) {
      uiStore.setConnectionStart(nodeId, resolvedSide)
      return
    }

    if (connectionStartNode.value !== nodeId && connectionStartSide.value) {
      createConnection(connectionStartNode.value, connectionStartSide.value, nodeId, resolvedSide)
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

  function onCanvasMouseDown(event: MouseEvent): boolean {
    if (!isConnectionMode.value) return false

    const target = event.target as Element | null
    if (target?.closest('.node')) return false

    if (!connectionStartNode.value || !connectionStartSide.value) {
      resetConnectionMode()
      return true
    }

    const clickPoint = getCanvasPoint(event)
    const origin = connectionDraftPoints.value[connectionDraftPoints.value.length - 1]
      ?? getConnectionPointForNode(connectionStartNode.value, connectionStartSide.value)
    const draftAxis = getDraftAxis()

    if (!clickPoint || !origin || !draftAxis) {
      return true
    }

    const projected = projectOrthogonalPoint(origin, clickPoint, draftAxis)
    uiStore.setConnectionDraftPoints(sanitizeOrthogonalCorners([
      ...connectionDraftPoints.value,
      {
        x: roundCoord(projected.x),
        y: roundCoord(projected.y),
      },
    ]))

    event.preventDefault()
    return true
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
      return
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
    connectionDraftPath,
    startConnectionMode,
    onNodeHoverSide,
    onNodeClick,
    onEdgeClick,
    onCanvasMouseDown,
    onCanvasClick,
    resetConnectionMode,
  }
}
