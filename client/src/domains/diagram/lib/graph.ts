import type { ConnectionSide, Edge, Node, Position, Segment } from '@/domains/graph'

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

export function isHorizontalPassThroughEdge(edge: Edge): boolean {
  return (edge.sourceSide === 'left' || edge.sourceSide === 'right')
    && (edge.targetSide === 'left' || edge.targetSide === 'right')
}

export function isVerticalPassThroughEdge(edge: Edge): boolean {
  return (edge.sourceSide === 'top' || edge.sourceSide === 'bottom')
    && (edge.targetSide === 'top' || edge.targetSide === 'bottom')
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
    if (x >= rect.left && x <= rect.right) {
      if (minY < rect.top && maxY > rect.top) {
        boundaries.add('top')
      }
      if (minY < rect.bottom && maxY > rect.bottom) {
        boundaries.add('bottom')
      }
    }
    return
  }

  if (isHorizontal) {
    const y = segment.start.y
    if (y >= rect.top && y <= rect.bottom) {
      if (minX < rect.left && maxX > rect.left) {
        boundaries.add('left')
      }
      if (minX < rect.right && maxX > rect.right) {
        boundaries.add('right')
      }
    }
  }
}

export function doesSegmentsPassThroughRect(segments: Segment[], rect: NodeRect): boolean {
  if (!segments.length) return false

  const boundaries = new Set<string>()
  segments.forEach(segment => collectBoundaryHits(segment, rect, boundaries))
  return boundaries.size >= 2
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
  const segments: Segment[] = []
  let currentPoint = start
  const { sourceSide, targetSide } = edge

  const needsThreeSegments =
    (sourceSide === 'left' && targetSide === 'right') ||
    (sourceSide === 'right' && targetSide === 'left') ||
    (sourceSide === 'top' && targetSide === 'bottom') ||
    (sourceSide === 'bottom' && targetSide === 'top') ||
    (sourceSide === 'left' && targetSide === 'left') ||
    (sourceSide === 'right' && targetSide === 'right') ||
    (sourceSide === 'top' && targetSide === 'top') ||
    (sourceSide === 'bottom' && targetSide === 'bottom')

  if (needsThreeSegments || edge.breakpointX !== undefined || edge.breakpointY !== undefined) {
    const defaultBreakpoint = getOrthogonalDefaultBreakpoint(edge, start, end)
    const breakpointX = edge.breakpointX ?? defaultBreakpoint.x
    const breakpointY = edge.breakpointY ?? defaultBreakpoint.y

    if (sourceSide === 'left' || sourceSide === 'right') {
      const point1 = { x: breakpointX, y: start.y }
      const point2 = { x: breakpointX, y: end.y }
      segments.push({ id: `${edge.id}-segment-1`, type: 'line', start: currentPoint, end: point1 })
      currentPoint = point1
      segments.push({ id: `${edge.id}-segment-2`, type: 'line', start: currentPoint, end: point2 })
      currentPoint = point2
      segments.push({ id: `${edge.id}-segment-3`, type: 'line', start: currentPoint, end })
      return segments
    }

    const point1 = { x: start.x, y: breakpointY }
    const point2 = { x: end.x, y: breakpointY }
    segments.push({ id: `${edge.id}-segment-1`, type: 'line', start: currentPoint, end: point1 })
    currentPoint = point1
    segments.push({ id: `${edge.id}-segment-2`, type: 'line', start: currentPoint, end: point2 })
    currentPoint = point2
    segments.push({ id: `${edge.id}-segment-3`, type: 'line', start: currentPoint, end })
    return segments
  }

  const bendPoint =
    sourceSide === 'left' || sourceSide === 'right'
      ? { x: end.x, y: start.y }
      : { x: start.x, y: end.y }

  segments.push({ id: `${edge.id}-segment-1`, type: 'line', start, end: bendPoint })
  segments.push({ id: `${edge.id}-segment-2`, type: 'line', start: bendPoint, end })

  return segments
}
