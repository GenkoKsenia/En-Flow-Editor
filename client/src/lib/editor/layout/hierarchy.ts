import type { Node, Position } from '@/models'
import { roundCoord } from './graph-layout'

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
