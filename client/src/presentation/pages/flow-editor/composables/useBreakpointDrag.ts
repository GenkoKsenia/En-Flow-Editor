import type { Ref } from 'vue'

import type { Edge } from '@/domains/graph'
import type { Node, Position } from '@/domains/graph'
import {
  buildOrthogonalEdgeSegments,
  getAbsoluteNodePosition,
  getNodeConnectionPoint,
  getOrthogonalRouteCorners,
  isAutoOrthogonalRoute,
  getSideAxis,
  roundCoord,
  sanitizeOrthogonalCorners,
} from '@/domains/diagram'

type UiBreakpointApi = {
  setDraggingBreakpoint(value: boolean): void
  setDraggingEdgeId(edgeId: string | null): void
}

type DiagramBreakpointApi = {
  isReadOnly?: boolean
  beginEdgeEdit(edgeId: string): Promise<boolean>
  endEdgeEdit(edgeId: string): Promise<void>
  finishEdgeUpdate(edgeId: string): Promise<void>
}

type UseBreakpointDragOptions = {
  nodes: Ref<Node[]>
  edges: Ref<Edge[]>
  isDraggingBreakpoint: Ref<boolean>
  draggingEdgeId: Ref<string | null>
  zoom: Ref<number>
  canvas: Ref<HTMLElement | null>
  uiStore: UiBreakpointApi
  diagramStore: DiagramBreakpointApi
  clampXValue: (edge: Edge, x: number) => number
  clampYValue: (edge: Edge, y: number) => number
}

function clonePoints(points: Position[]): Position[] {
  return points.map(point => ({ x: point.x, y: point.y }))
}

const MERGE_SNAP_DISTANCE = 14

export function useBreakpointDrag({
  nodes,
  edges,
  isDraggingBreakpoint,
  draggingEdgeId,
  zoom,
  canvas,
  uiStore,
  diagramStore,
  clampXValue,
  clampYValue,
}: UseBreakpointDragOptions) {
  function resolveEdgePoints(edge: Edge): { start: Position; end: Position } | null {
    const sourceNode = nodes.value.find(item => item.id === edge.sourceNodeId)
    const targetNode = nodes.value.find(item => item.id === edge.targetNodeId)
    if (!sourceNode || !targetNode) {
      return null
    }

    const start = getNodeConnectionPoint(
      getAbsoluteNodePosition(nodes.value, sourceNode),
      sourceNode,
      edge.sourceSide,
    )
    const end = getNodeConnectionPoint(
      getAbsoluteNodePosition(nodes.value, targetNode),
      targetNode,
      edge.targetSide,
    )

    return { start, end }
  }

  async function onBreakpointDragStart(
    edgeId: string,
    segmentIndex: number,
    event: MouseEvent,
  ): Promise<void> {
    if (diagramStore.isReadOnly) return

    const locked = await diagramStore.beginEdgeEdit(edgeId)
    if (!locked) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    uiStore.setDraggingBreakpoint(true)
    uiStore.setDraggingEdgeId(edgeId)

    const edge = edges.value.find(item => item.id === edgeId)
    if (!edge) {
      uiStore.setDraggingBreakpoint(false)
      uiStore.setDraggingEdgeId(null)
      void diagramStore.endEdgeEdit(edgeId)
      return
    }

    const resolvedPoints = resolveEdgePoints(edge)
    if (!resolvedPoints) {
      uiStore.setDraggingBreakpoint(false)
      uiStore.setDraggingEdgeId(null)
      void diagramStore.endEdgeEdit(edgeId)
      return
    }

    edge.breakpointLocked = true
    const routePoints = clonePoints(getOrthogonalRouteCorners(edge, resolvedPoints.start, resolvedPoints.end))
    const geometry = buildOrthogonalEdgeSegments(
      { ...edge, breakpoints: routePoints },
      resolvedPoints.start,
      resolvedPoints.end,
    )
    const segment = geometry[segmentIndex]

    if (!segment || !routePoints.length) {
      uiStore.setDraggingBreakpoint(false)
      uiStore.setDraggingEdgeId(null)
      edge.breakpointLocked = false
      void diagramStore.endEdgeEdit(edgeId)
      return
    }

    const isFirstSegment = segmentIndex === 0
    const isLastSegment = segmentIndex === geometry.length - 1
    const isVertical = Math.abs(segment.start.x - segment.end.x) <= 0.01
    const basePoints = clonePoints(routePoints)
    const shouldClampLegacyAxis = basePoints.length === 2

    const dragAxis: 'x' | 'y' = isFirstSegment
      ? (getSideAxis(edge.sourceSide) === 'horizontal' ? 'y' : 'x')
      : isLastSegment
        ? (getSideAxis(edge.targetSide) === 'horizontal' ? 'y' : 'x')
        : (isVertical ? 'x' : 'y')

    const pointIndices = isFirstSegment
      ? [0]
      : isLastSegment
        ? [routePoints.length - 1]
        : [segmentIndex - 1, segmentIndex]

    function snapMovedPoints(points: Position[]): Position[] {
      const next = clonePoints(points)

      if (dragAxis === 'x') {
        if (Math.abs(next[0]!.x - resolvedPoints.start.x) <= MERGE_SNAP_DISTANCE) {
          next[0]!.x = resolvedPoints.start.x
        }

        const lastIndex = next.length - 1
        if (Math.abs(next[lastIndex]!.x - resolvedPoints.end.x) <= MERGE_SNAP_DISTANCE) {
          next[lastIndex]!.x = resolvedPoints.end.x
        }

        for (let index = 1; index < next.length; index += 1) {
          if (Math.abs(next[index - 1]!.x - next[index]!.x) <= MERGE_SNAP_DISTANCE) {
            next[index]!.x = next[index - 1]!.x
          }
        }
      } else {
        if (Math.abs(next[0]!.y - resolvedPoints.start.y) <= MERGE_SNAP_DISTANCE) {
          next[0]!.y = resolvedPoints.start.y
        }

        const lastIndex = next.length - 1
        if (Math.abs(next[lastIndex]!.y - resolvedPoints.end.y) <= MERGE_SNAP_DISTANCE) {
          next[lastIndex]!.y = resolvedPoints.end.y
        }

        for (let index = 1; index < next.length; index += 1) {
          if (Math.abs(next[index - 1]!.y - next[index]!.y) <= MERGE_SNAP_DISTANCE) {
            next[index]!.y = next[index - 1]!.y
          }
        }
      }

      return next
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingBreakpoint.value || !draggingEdgeId.value || !canvas.value) return

      const activeEdge = edges.value.find(item => item.id === draggingEdgeId.value)
      if (!activeEdge) return

      const canvasRect = canvas.value.getBoundingClientRect()
      const scale = zoom.value || 1
      const scrollLeft = canvas.value.scrollLeft
      const scrollTop = canvas.value.scrollTop
      const nextPoints = clonePoints(basePoints)

      if (dragAxis === 'x') {
        let newX = (moveEvent.clientX - canvasRect.left + scrollLeft) / scale
        if (shouldClampLegacyAxis) {
          newX = clampXValue(activeEdge, newX)
        }
        pointIndices.forEach(pointIndex => {
          nextPoints[pointIndex]!.x = roundCoord(newX)
        })
      } else {
        let newY = (moveEvent.clientY - canvasRect.top + scrollTop) / scale
        if (shouldClampLegacyAxis) {
          newY = clampYValue(activeEdge, newY)
        }
        pointIndices.forEach(pointIndex => {
          nextPoints[pointIndex]!.y = roundCoord(newY)
        })
      }

      activeEdge.breakpoints = sanitizeOrthogonalCorners(snapMovedPoints(nextPoints), {
        start: resolvedPoints.start,
        end: resolvedPoints.end,
      })
      activeEdge.breakpointX = undefined
      activeEdge.breakpointY = undefined
    }

    const onMouseUp = () => {
      const activeEdge = edges.value.find(item => item.id === edgeId)
      if (activeEdge) {
        activeEdge.breakpoints = sanitizeOrthogonalCorners(activeEdge.breakpoints ?? [], {
          start: resolvedPoints.start,
          end: resolvedPoints.end,
        })
        if (isAutoOrthogonalRoute(activeEdge, resolvedPoints.start, resolvedPoints.end)) {
          activeEdge.breakpoints = undefined
          activeEdge.breakpointX = undefined
          activeEdge.breakpointY = undefined
        }
        activeEdge.breakpointLocked = false
      }

      uiStore.setDraggingBreakpoint(false)
      uiStore.setDraggingEdgeId(null)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      void diagramStore.finishEdgeUpdate(edgeId)
      void diagramStore.endEdgeEdit(edgeId)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    event.preventDefault()
    event.stopPropagation()
  }

  return {
    onBreakpointDragStart,
  }
}
