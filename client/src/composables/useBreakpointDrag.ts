import type { Ref } from 'vue'

import type { Edge } from '@/models'
import { roundCoord } from '@/lib/editor/layout'

type UiBreakpointApi = {
  setDraggingBreakpoint(value: boolean): void
  setDraggingEdgeId(edgeId: string | null): void
}

type UseBreakpointDragOptions = {
  edges: Ref<Edge[]>
  isDraggingBreakpoint: Ref<boolean>
  draggingEdgeId: Ref<string | null>
  zoom: Ref<number>
  canvas: Ref<HTMLElement | null>
  uiStore: UiBreakpointApi
  clampXValue: (edge: Edge, x: number) => number
  clampYValue: (edge: Edge, y: number) => number
}

export function useBreakpointDrag({
  edges,
  isDraggingBreakpoint,
  draggingEdgeId,
  zoom,
  canvas,
  uiStore,
  clampXValue,
  clampYValue,
}: UseBreakpointDragOptions) {
  function onBreakpointDragStart(edgeId: string, event: MouseEvent): void {
    uiStore.setDraggingBreakpoint(true)
    uiStore.setDraggingEdgeId(edgeId)

    const edge = edges.value.find(item => item.id === edgeId)
    if (!edge) return
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
        activeEdge.breakpointX = roundCoord(clampXValue(activeEdge, newX))
      } else {
        const newY = (moveEvent.clientY - canvasRect.top + scrollTop) / scale
        activeEdge.breakpointY = roundCoord(clampYValue(activeEdge, newY))
      }
    }

    const onMouseUp = () => {
      uiStore.setDraggingBreakpoint(false)
      uiStore.setDraggingEdgeId(null)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
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
