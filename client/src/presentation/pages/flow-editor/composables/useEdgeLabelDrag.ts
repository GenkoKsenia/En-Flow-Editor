import type { Ref } from 'vue'

import type { Edge, Node, Position, Segment } from '@/domains/graph'
import {
  buildOrthogonalEdgeSegments,
  clampEdgeLabelPosition,
  getAbsoluteNodePosition,
  getNodeConnectionPoint,
} from '@/domains/diagram'

type DiagramLabelDragApi = {
  isReadOnly?: boolean
  beginEdgeEdit(edgeId: string): Promise<boolean>
  endEdgeEdit(edgeId: string): Promise<void>
  finishEdgeUpdate(edgeId: string): Promise<void>
}

type UseEdgeLabelDragOptions = {
  nodes: Ref<Node[]>
  edges: Ref<Edge[]>
  zoom: Ref<number>
  canvas: Ref<HTMLElement | null>
  diagramStore: DiagramLabelDragApi
  persistDiagram?: () => Promise<void>
}

type ClosestPointResult = {
  distance: number
  pathLength: number
}

function getSegmentLength(segment: Segment): number {
  return Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y)
}

function findClosestPointOnSegment(segment: Segment, point: Position, offset: number): ClosestPointResult {
  const dx = segment.end.x - segment.start.x
  const dy = segment.end.y - segment.start.y
  const lengthSquared = dx * dx + dy * dy

  if (!lengthSquared) {
    return {
      distance: Math.hypot(point.x - segment.start.x, point.y - segment.start.y),
      pathLength: offset,
    }
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared,
    ),
  )

  const closest = {
    x: segment.start.x + dx * projection,
    y: segment.start.y + dy * projection,
  }

  return {
    distance: Math.hypot(point.x - closest.x, point.y - closest.y),
    pathLength: offset + getSegmentLength(segment) * projection,
  }
}

export function useEdgeLabelDrag({
  nodes,
  edges,
  zoom,
  canvas,
  diagramStore,
  persistDiagram,
}: UseEdgeLabelDragOptions) {
  function resolveEdgeSegments(edge: Edge): Segment[] {
    const sourceNode = nodes.value.find(item => item.id === edge.sourceNodeId)
    const targetNode = nodes.value.find(item => item.id === edge.targetNodeId)
    if (!sourceNode || !targetNode) {
      return []
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

    return buildOrthogonalEdgeSegments(edge, start, end)
  }

  function getCanvasPoint(event: MouseEvent): Position | null {
    if (!canvas.value) return null

    const canvasRect = canvas.value.getBoundingClientRect()
    const scale = zoom.value || 1

    return {
      x: (event.clientX - canvasRect.left + canvas.value.scrollLeft) / scale,
      y: (event.clientY - canvasRect.top + canvas.value.scrollTop) / scale,
    }
  }

  function getLabelPositionFromMouse(segments: Segment[], point: Position): number | null {
    if (!segments.length) return null

    const totalLength = segments.reduce((sum, segment) => sum + getSegmentLength(segment), 0)
    if (!totalLength) return null

    let traversed = 0
    let best: ClosestPointResult | null = null

    segments.forEach(segment => {
      const next = findClosestPointOnSegment(segment, point, traversed)
      if (!best || next.distance < best.distance) {
        best = next
      }
      traversed += getSegmentLength(segment)
    })

    if (!best) return null
    return clampEdgeLabelPosition(best.pathLength / totalLength)
  }

  async function onLabelDragStart(edgeId: string, event: MouseEvent): Promise<void> {
    if (diagramStore.isReadOnly) return

    const locked = await diagramStore.beginEdgeEdit(edgeId)
    if (!locked) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    const edge = edges.value.find(item => item.id === edgeId)
    const initialSegments = edge ? resolveEdgeSegments(edge) : []
    if (!edge || !initialSegments.length) {
      void diagramStore.endEdgeEdit(edgeId)
      return
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      const activeEdge = edges.value.find(item => item.id === edgeId)
      if (!activeEdge) return

      const point = getCanvasPoint(moveEvent)
      if (!point) return

      const segments = resolveEdgeSegments(activeEdge)
      const labelPosition = getLabelPositionFromMouse(segments, point)
      if (labelPosition === null) return

      activeEdge.labelPosition = labelPosition
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      void diagramStore.finishEdgeUpdate(edgeId)
      if (persistDiagram) {
        void persistDiagram().catch(() => undefined)
      }
      void diagramStore.endEdgeEdit(edgeId)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    event.preventDefault()
    event.stopPropagation()
  }

  return {
    onLabelDragStart,
  }
}
