import type { Ref } from 'vue'

import type { Edge } from '@/domains/graph'
import type { Node, Position } from '@/domains/graph'
import {
  getAbsoluteNodePosition,
  getNodeConnectionPoint,
  getOrthogonalDefaultBreakpoint,
  roundCoord,
} from '@/domains/diagram'

type UiBreakpointApi = {
  setDraggingBreakpoint(value: boolean): void
  setDraggingEdgeId(edgeId: string | null): void
}

type DiagramBreakpointApi = {
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
  function resolveBreakpointFallback(edge: Edge): Position {
    const sourceNode = nodes.value.find(item => item.id === edge.sourceNodeId)
    const targetNode = nodes.value.find(item => item.id === edge.targetNodeId)
    if (!sourceNode || !targetNode) {
      return { x: 0, y: 0 }
    }

    const sourcePoint = getNodeConnectionPoint(
      getAbsoluteNodePosition(nodes.value, sourceNode),
      sourceNode,
      edge.sourceSide,
    )
    const targetPoint = getNodeConnectionPoint(
      getAbsoluteNodePosition(nodes.value, targetNode),
      targetNode,
      edge.targetSide,
    )

    return getOrthogonalDefaultBreakpoint(edge, sourcePoint, targetPoint)
  }

  async function onBreakpointDragStart(edgeId: string, event: MouseEvent): Promise<void> {
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
    edge.breakpointLocked = true

    const { sourceSide, targetSide } = edge
    let axis: 'x' | 'y' = 'x'

    if (
      (sourceSide === 'left' && targetSide === 'right') ||
      (sourceSide === 'right' && targetSide === 'left') ||
      (sourceSide === 'left' && targetSide === 'left') ||
      (sourceSide === 'right' && targetSide === 'right')
    ) {
      axis = 'x'
    } else {
      axis = 'y'
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingBreakpoint.value || !draggingEdgeId.value || !canvas.value) return

      const activeEdge = edges.value.find(item => item.id === draggingEdgeId.value)
      if (!activeEdge) return

      const canvasRect = canvas.value.getBoundingClientRect()
      const scale = zoom.value || 1
      const scrollLeft = canvas.value.scrollLeft
      const scrollTop = canvas.value.scrollTop

      if (axis === 'x') {
        const newX = (moveEvent.clientX - canvasRect.left + scrollLeft) / scale
        if (typeof activeEdge.breakpointY !== 'number') {
          activeEdge.breakpointY = roundCoord(resolveBreakpointFallback(activeEdge).y)
        }
        activeEdge.breakpointX = roundCoord(clampXValue(activeEdge, newX))
      } else {
        const newY = (moveEvent.clientY - canvasRect.top + scrollTop) / scale
        if (typeof activeEdge.breakpointX !== 'number') {
          activeEdge.breakpointX = roundCoord(resolveBreakpointFallback(activeEdge).x)
        }
        activeEdge.breakpointY = roundCoord(clampYValue(activeEdge, newY))
      }
    }

    const onMouseUp = () => {
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
