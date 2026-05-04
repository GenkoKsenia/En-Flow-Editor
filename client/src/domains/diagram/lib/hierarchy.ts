import type { Node, Position } from '@/domains/graph'

import { roundCoord } from './layout'

type Rect = {
  x: number
  y: number
  width: number
  height: number
}

function findNode(nodes: Node[], nodeId: string): Node | undefined {
  return nodes.find(node => node.id === nodeId)
}

export function getAbsoluteNodePosition(nodes: Node[], node: Node): Position {
  if (!node.parentId) {
    return node.position
  }

  const parent = findNode(nodes, node.parentId)
  if (!parent) {
    return node.position
  }

  const parentAbsolute = getAbsoluteNodePosition(nodes, parent)
  return {
    x: parentAbsolute.x + node.position.x,
    y: parentAbsolute.y + node.position.y,
  }
}

export function getDescendantNodes(nodes: Node[], nodeId: string): Node[] {
  const children: Node[] = []
  const directChildren = nodes.filter(node => node.parentId === nodeId)

  for (const child of directChildren) {
    children.push(child)
    children.push(...getDescendantNodes(nodes, child.id))
  }

  return children
}

export function getPotentialParentCandidates(nodes: Node[]): Array<{
  id: string
  rect: { x: number; y: number; width: number; height: number }
}> {
  return nodes.map(node => {
    const absolute = getAbsoluteNodePosition(nodes, node)
    return {
      id: node.id,
      rect: {
        x: absolute.x,
        y: absolute.y,
        width: node.width,
        height: node.height,
      },
    }
  })
}

export function getRootNodePosition(currentAbsolutePos: Position): Position {
  return {
    x: roundCoord(currentAbsolutePos.x),
    y: roundCoord(currentAbsolutePos.y),
  }
}

function rectsOverlap(first: Rect, second: Rect): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  )
}

export function findFreeLeftPlacement(
  nodes: Node[],
  size: { width: number; height: number },
  options?: {
    defaultPosition?: Position
    verticalGap?: number
  },
): Position {
  const defaultPosition = options?.defaultPosition ?? { x: 100, y: 100 }
  const verticalGap = options?.verticalGap ?? 24

  if (!nodes.length) {
    return getRootNodePosition(defaultPosition)
  }

  const rects = nodes.map(node => {
    const absolute = getAbsoluteNodePosition(nodes, node)
    return {
      x: absolute.x,
      y: absolute.y,
      width: node.width,
      height: node.height,
    }
  })

  const nextRect: Rect = {
    x: defaultPosition.x,
    y: defaultPosition.y,
    width: size.width,
    height: size.height,
  }

  let hasOverlap = true
  while (hasOverlap) {
    const overlappingRects = rects.filter(rect => rectsOverlap(nextRect, rect))
    if (!overlappingRects.length) {
      hasOverlap = false
      break
    }

    nextRect.y = Math.max(...overlappingRects.map(rect => rect.y + rect.height)) + verticalGap
  }

  return getRootNodePosition({ x: nextRect.x, y: nextRect.y })
}
