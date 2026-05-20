import type { ConnectionSide, Edge, Node, Position, Segment } from '@/domains/graph'
import { roundCoord } from './layout'

export type NodeRect = {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

export type PassThroughOffsets = Record<string, {
  horizontal: Record<string, number>
  vertical: Record<string, number>
}>

const RECT_INTERSECTION_EPSILON = 0.01
export type SegmentAxis = 'horizontal' | 'vertical'

export function getSideAxis(side: ConnectionSide): SegmentAxis {
  return side === 'left' || side === 'right' ? 'horizontal' : 'vertical'
}

export function toggleSegmentAxis(axis: SegmentAxis): SegmentAxis {
  return axis === 'horizontal' ? 'vertical' : 'horizontal'
}

function pointsEqual(left: Position, right: Position): boolean {
  return Math.abs(left.x - right.x) <= RECT_INTERSECTION_EPSILON
    && Math.abs(left.y - right.y) <= RECT_INTERSECTION_EPSILON
}

function toSegment(id: string, start: Position, end: Position): Segment | null {
  if (pointsEqual(start, end)) return null

  return {
    id,
    type: 'line',
    start,
    end,
  }
}

export function projectOrthogonalPoint(
  origin: Position,
  target: Position,
  axis: SegmentAxis,
): Position {
  return axis === 'horizontal'
    ? { x: target.x, y: origin.y }
    : { x: origin.x, y: target.y }
}

export function sanitizeOrthogonalCorners(points: Position[]): Position[] {
  return points.reduce<Position[]>((result, point) => {
    const normalizedPoint = {
      x: roundCoord(point.x),
      y: roundCoord(point.y),
    }

    if (!result.length || !pointsEqual(result[result.length - 1]!, normalizedPoint)) {
      result.push(normalizedPoint)
    }

    return result
  }, [])
}

export function getNodeConnectionPoint(
  position: Position,
  node: Pick<Node, 'width' | 'height'>,
  side: ConnectionSide,
  ratio = 0.5,
): Position {
  switch (side) {
    case 'top':
      return {
        x: position.x + node.width * ratio,
        y: position.y,
      }
    case 'right':
      return {
        x: position.x + node.width,
        y: position.y + node.height * ratio,
      }
    case 'bottom':
      return {
        x: position.x + node.width * ratio,
        y: position.y + node.height,
      }
    case 'left':
      return {
        x: position.x,
        y: position.y + node.height * ratio,
      }
  }
}

export function getOrthogonalDefaultBreakpoint(
  edge: Pick<Edge, 'sourceSide' | 'targetSide'>,
  start: Position,
  end: Position,
): Position {
  const { sourceSide, targetSide } = edge

  const x = (() => {
    if (sourceSide === 'left' && targetSide === 'left') return Math.min(start.x, end.x) - 80
    if (sourceSide === 'right' && targetSide === 'right') return Math.max(start.x, end.x) + 80
    return (start.x + end.x) / 2
  })()

  const y = (() => {
    if (sourceSide === 'top' && targetSide === 'top') return Math.min(start.y, end.y) - 40
    if (sourceSide === 'bottom' && targetSide === 'bottom') return Math.max(start.y, end.y) + 40
    return (start.y + end.y) / 2
  })()

  return { x, y }
}

export function buildLegacyBreakpointCorners(
  edge: Pick<Edge, 'id' | 'sourceSide' | 'targetSide' | 'breakpointX' | 'breakpointY'>,
  start: Position,
  end: Position,
): Position[] {
  const fallback = getOrthogonalDefaultBreakpoint(edge, start, end)
  const breakpointX = edge.breakpointX ?? fallback.x
  const breakpointY = edge.breakpointY ?? fallback.y

  if (getSideAxis(edge.sourceSide) === 'horizontal') {
    return [
      { x: breakpointX, y: start.y },
      { x: breakpointX, y: end.y },
    ].filter((point, index, points) => index === 0 || !pointsEqual(point, points[index - 1]!))
  }

  return [
    { x: start.x, y: breakpointY },
    { x: end.x, y: breakpointY },
  ].filter((point, index, points) => index === 0 || !pointsEqual(point, points[index - 1]!))
}

export function buildOrthogonalConnectorCorners(
  start: Position,
  end: Position,
  firstAxis: SegmentAxis,
  lastAxis: SegmentAxis,
): Position[] {
  if (firstAxis === lastAxis) {
    if (firstAxis === 'horizontal' && Math.abs(start.y - end.y) <= RECT_INTERSECTION_EPSILON) {
      return []
    }

    if (firstAxis === 'vertical' && Math.abs(start.x - end.x) <= RECT_INTERSECTION_EPSILON) {
      return []
    }

    if (firstAxis === 'horizontal') {
      const midpointX = (start.x + end.x) / 2
      return [
        { x: midpointX, y: start.y },
        { x: midpointX, y: end.y },
      ]
    }

    const midpointY = (start.y + end.y) / 2
    return [
      { x: start.x, y: midpointY },
      { x: end.x, y: midpointY },
    ]
  }

  if (firstAxis === 'horizontal') {
    return [{ x: end.x, y: start.y }]
  }

  return [{ x: start.x, y: end.y }]
}

export function getOrthogonalRouteCorners(
  edge: Pick<Edge, 'id' | 'sourceSide' | 'targetSide' | 'breakpoints' | 'breakpointX' | 'breakpointY'>,
  start: Position,
  end: Position,
): Position[] {
  if (edge.breakpoints?.length) {
    const corners: Position[] = []
    let currentPoint = start
    let currentAxis = getSideAxis(edge.sourceSide)

    sanitizeOrthogonalCorners(edge.breakpoints).forEach(point => {
      const projectedPoint = projectOrthogonalPoint(currentPoint, point, currentAxis)
      if (pointsEqual(currentPoint, projectedPoint)) {
        return
      }

      corners.push(projectedPoint)
      currentPoint = projectedPoint
      currentAxis = toggleSegmentAxis(currentAxis)
    })

    return sanitizeOrthogonalCorners([
      ...corners,
      ...buildOrthogonalConnectorCorners(
        currentPoint,
        end,
        currentAxis,
        getSideAxis(edge.targetSide),
      ),
    ])
  }

  if (edge.breakpointX !== undefined || edge.breakpointY !== undefined) {
    return buildLegacyBreakpointCorners(edge, start, end)
  }

  return buildOrthogonalConnectorCorners(
    start,
    end,
    getSideAxis(edge.sourceSide),
    getSideAxis(edge.targetSide),
  )
}

export function supportsPassThroughEdge(edge: Pick<Edge, 'sourceSide' | 'targetSide'>): boolean {
  return (
    (edge.sourceSide === 'left' && edge.targetSide === 'right') ||
    (edge.sourceSide === 'right' && edge.targetSide === 'left') ||
    (edge.sourceSide === 'top' && edge.targetSide === 'bottom') ||
    (edge.sourceSide === 'bottom' && edge.targetSide === 'top') ||
    (edge.sourceSide === 'left' && edge.targetSide === 'left') ||
    (edge.sourceSide === 'right' && edge.targetSide === 'right') ||
    (edge.sourceSide === 'top' && edge.targetSide === 'top') ||
    (edge.sourceSide === 'bottom' && edge.targetSide === 'bottom')
  )
}

export function isHorizontalPassThroughEdge(edge: Edge): boolean {
  return supportsPassThroughEdge(edge)
    && (edge.sourceSide === 'left' || edge.sourceSide === 'right')
}

export function isVerticalPassThroughEdge(edge: Edge): boolean {
  return supportsPassThroughEdge(edge)
    && (edge.sourceSide === 'top' || edge.sourceSide === 'bottom')
}

export function collectBoundaryHits(
  segment: Segment,
  rect: Pick<NodeRect, 'left' | 'right' | 'top' | 'bottom'>,
  boundaries: Set<string>,
): void {
  const isVertical = segment.start.x === segment.end.x
  const isHorizontal = segment.start.y === segment.end.y
  const minX = Math.min(segment.start.x, segment.end.x)
  const maxX = Math.max(segment.start.x, segment.end.x)
  const minY = Math.min(segment.start.y, segment.end.y)
  const maxY = Math.max(segment.start.y, segment.end.y)

  if (isVertical) {
    const x = segment.start.x
    if (x >= rect.left - RECT_INTERSECTION_EPSILON && x <= rect.right + RECT_INTERSECTION_EPSILON) {
      if (minY <= rect.top + RECT_INTERSECTION_EPSILON && maxY >= rect.top - RECT_INTERSECTION_EPSILON) {
        boundaries.add('top')
      }
      if (minY <= rect.bottom + RECT_INTERSECTION_EPSILON && maxY >= rect.bottom - RECT_INTERSECTION_EPSILON) {
        boundaries.add('bottom')
      }
    }
    return
  }

  if (isHorizontal) {
    const y = segment.start.y
    if (y >= rect.top - RECT_INTERSECTION_EPSILON && y <= rect.bottom + RECT_INTERSECTION_EPSILON) {
      if (minX <= rect.left + RECT_INTERSECTION_EPSILON && maxX >= rect.left - RECT_INTERSECTION_EPSILON) {
        boundaries.add('left')
      }
      if (minX <= rect.right + RECT_INTERSECTION_EPSILON && maxX >= rect.right - RECT_INTERSECTION_EPSILON) {
        boundaries.add('right')
      }
    }
  }
}

function segmentPassesThroughRectInterior(
  segment: Segment,
  rect: Pick<NodeRect, 'left' | 'right' | 'top' | 'bottom'>,
): boolean {
  const isVertical = Math.abs(segment.start.x - segment.end.x) <= RECT_INTERSECTION_EPSILON
  const isHorizontal = Math.abs(segment.start.y - segment.end.y) <= RECT_INTERSECTION_EPSILON

  if (isVertical) {
    const x = segment.start.x
    if (x <= rect.left + RECT_INTERSECTION_EPSILON || x >= rect.right - RECT_INTERSECTION_EPSILON) {
      return false
    }

    const minY = Math.min(segment.start.y, segment.end.y)
    const maxY = Math.max(segment.start.y, segment.end.y)
    return Math.min(maxY, rect.bottom) - Math.max(minY, rect.top) > RECT_INTERSECTION_EPSILON
  }

  if (isHorizontal) {
    const y = segment.start.y
    if (y <= rect.top + RECT_INTERSECTION_EPSILON || y >= rect.bottom - RECT_INTERSECTION_EPSILON) {
      return false
    }

    const minX = Math.min(segment.start.x, segment.end.x)
    const maxX = Math.max(segment.start.x, segment.end.x)
    return Math.min(maxX, rect.right) - Math.max(minX, rect.left) > RECT_INTERSECTION_EPSILON
  }

  return false
}

export function doesSegmentsPassThroughRect(segments: Segment[], rect: NodeRect): boolean {
  if (!segments.length) return false

  return segments.some(segment => segmentPassesThroughRectInterior(segment, rect))
}

export function calculatePassThroughOffsets(nodes: Node[], edges: Edge[]): PassThroughOffsets {
  const layout: PassThroughOffsets = {}

  nodes.forEach(node => {
    const required = node.passThroughEdges || []
    if (!required.length) return

    const horizontal: Record<string, number> = {}
    const vertical: Record<string, number> = {}

    const horizontalEdges = required
      .map(edgeId => edges.find(edge => edge.id === edgeId))
      .filter((edge): edge is Edge => !!edge && isHorizontalPassThroughEdge(edge))
      .sort((a, b) => a.id.localeCompare(b.id))

    const verticalEdges = required
      .map(edgeId => edges.find(edge => edge.id === edgeId))
      .filter((edge): edge is Edge => !!edge && isVerticalPassThroughEdge(edge))
      .sort((a, b) => a.id.localeCompare(b.id))

    horizontalEdges.forEach((edge, index) => {
      horizontal[edge.id] = (index + 1) / (horizontalEdges.length + 1)
    })

    verticalEdges.forEach((edge, index) => {
      vertical[edge.id] = (index + 1) / (verticalEdges.length + 1)
    })

    layout[node.id] = { horizontal, vertical }
  })

  return layout
}

export function getPassThroughFraction(
  layout: PassThroughOffsets,
  nodeId: string,
  edgeId: string,
  orientation: 'horizontal' | 'vertical',
): number {
  const nodeLayout = layout[nodeId]
  if (!nodeLayout) return 0.5
  return nodeLayout[orientation][edgeId] ?? 0.5
}

export function buildOrthogonalEdgeSegments(edge: Edge, start: Position, end: Position): Segment[] {
  const points = getOrthogonalRouteCorners(edge, start, end)

  const segments: Segment[] = []
  let currentPoint = start

  points.forEach((point, index) => {
    const segment = toSegment(`${edge.id}-segment-${index + 1}`, currentPoint, point)
    if (segment) {
      segments.push(segment)
      currentPoint = point
    }
  })

  const finalSegment = toSegment(`${edge.id}-segment-${segments.length + 1}`, currentPoint, end)
  if (finalSegment) {
    segments.push(finalSegment)
  }

  return segments
}
