import type { Edge, Node, Position } from '@/domains/graph'

import {
  calculatePassThroughOffsets,
  findPotentialParentByCenter,
  getAbsoluteNodePosition as resolveAbsoluteNodePosition,
  getDescendantNodes as resolveDescendantNodes,
  getPassThroughFraction as resolvePassThroughFraction,
  getParentChildCountMap,
  getPotentialParentCandidates,
  getRelativePositionWithinParent,
  getRequiredParentSize,
  getRootNodePosition,
  isHorizontalPassThroughEdge,
  isVerticalPassThroughEdge,
  getNodeBorderStyleMode,
  resolveNodeBorderStyle,
  roundCoord,
  setNodeBorderStyleMode,
  toAbsoluteNodeRect,
} from '../lib'

import type { DiagramContext } from './diagram.context'

export function createDiagramParentingUseCases(context: DiagramContext) {
  function getAbsoluteNodePosition(node: Node): Position {
    return resolveAbsoluteNodePosition(context.nodes.value, node)
  }

  function getDescendantNodes(nodeId: string): Node[] {
    return resolveDescendantNodes(context.nodes.value, nodeId)
  }

  function getNodeRect(node: Node) {
    return toAbsoluteNodeRect(getAbsoluteNodePosition(node), node)
  }

  function getPassThroughFraction(nodeId: string, edgeId: string, orientation: 'horizontal' | 'vertical'): number {
    const layout = calculatePassThroughOffsets(context.nodes.value, context.edges.value)
    return resolvePassThroughFraction(layout, nodeId, edgeId, orientation)
  }

  function alignEdgeToNode(edge: Edge, node: Node): void {
    const rect = getNodeRect(node)
    if (isHorizontalPassThroughEdge(edge)) {
      edge.breakpoints = undefined
      edge.breakpointX = roundCoord(rect.left + rect.width * getPassThroughFraction(node.id, edge.id, 'horizontal'))
      return
    }

    if (isVerticalPassThroughEdge(edge)) {
      edge.breakpoints = undefined
      edge.breakpointY = roundCoord(rect.top + rect.height * getPassThroughFraction(node.id, edge.id, 'vertical'))
    }
  }

  function maintainPassThroughEdges(nodeId: string | null | undefined): void {
    if (!nodeId) return
    const node = context.nodes.value.find(item => item.id === nodeId)
    if (!node || !node.passThroughEdges?.length) return

    node.passThroughEdges.forEach(edgeId => {
      const edge = context.edges.value.find(item => item.id === edgeId)
      if (!edge || edge.breakpointLocked) return
      alignEdgeToNode(edge, node)
    })
  }

  function refreshParentBorders(): void {
    const childCount = getParentChildCountMap(context.nodes.value)
    context.nodes.value.forEach(node => {
      if (getNodeBorderStyleMode(node, childCount[node.id] || 0) === 'manual') {
        return
      }

      node.borderStyle = resolveNodeBorderStyle(node, childCount[node.id] || 0)
      setNodeBorderStyleMode(node, 'auto')
    })
  }

  function ensureParentPadding(parentId: string | null | undefined, padding = 24): void {
    if (!parentId) return
    const parent = context.nodes.value.find(item => item.id === parentId)
    if (!parent) return

    const children = context.nodes.value.filter(item => item.parentId === parentId)
    if (!children.length) return

    const requiredSize = getRequiredParentSize(parent, children, padding)
    parent.width = requiredSize.width
    parent.height = requiredSize.height
    maintainPassThroughEdges(parentId)
    ensureParentPadding(parent.parentId, padding)
  }

  function findPotentialParentId(
    draggedNodeId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): string | null {
    const allChildren = getDescendantNodes(draggedNodeId)
    const excludedIds = new Set(allChildren.map(child => child.id))
    excludedIds.add(draggedNodeId)

    return findPotentialParentByCenter(
      getPotentialParentCandidates(context.nodes.value),
      excludedIds,
      { x, y, width, height },
    )
  }

  function moveNodeToParent(
    nodeId: string,
    parentId: string | null,
    absoluteX?: number,
    absoluteY?: number,
    padding = 24,
  ): void {
    const node = context.nodes.value.find(item => item.id === nodeId)
    if (!node) return

    const currentAbsolutePos = absoluteX !== undefined && absoluteY !== undefined
      ? { x: absoluteX, y: absoluteY }
      : getAbsoluteNodePosition(node)

    if (parentId) {
      const parent = context.nodes.value.find(item => item.id === parentId)
      if (parent) {
        const parentAbsolutePos = getAbsoluteNodePosition(parent)
        const relativePos = getRelativePositionWithinParent(currentAbsolutePos, parentAbsolutePos, padding)
        node.position.x = relativePos.x
        node.position.y = relativePos.y
        node.parentId = parentId
        ensureParentPadding(parentId, padding)
      }
    } else {
      const rootPosition = getRootNodePosition(currentAbsolutePos)
      node.position.x = rootPosition.x
      node.position.y = rootPosition.y
      node.parentId = undefined
    }

    maintainPassThroughEdges(nodeId)
    refreshParentBorders()
  }

  function finalizeNodeDrag(
    nodeId: string,
    potentialParentId: string | null,
    newAbsoluteX: number,
    newAbsoluteY: number,
    padding = 24,
  ): void {
    const node = context.nodes.value.find(item => item.id === nodeId)
    if (!node) return

    if (potentialParentId && potentialParentId !== node.parentId) {
      moveNodeToParent(nodeId, potentialParentId, newAbsoluteX, newAbsoluteY, padding)
      return
    }

    if (!potentialParentId && node.parentId) {
      moveNodeToParent(nodeId, null, newAbsoluteX, newAbsoluteY, padding)
      getDescendantNodes(nodeId).forEach(child => {
        const childAbsolutePos = getAbsoluteNodePosition(child)
        moveNodeToParent(child.id, null, roundCoord(childAbsolutePos.x), roundCoord(childAbsolutePos.y), padding)
      })
      return
    }

    if (node.parentId) {
      const parent = context.nodes.value.find(item => item.id === node.parentId)
      if (parent) {
        const parentAbsolute = getAbsoluteNodePosition(parent)
        const relativePos = getRelativePositionWithinParent(
          { x: newAbsoluteX, y: newAbsoluteY },
          parentAbsolute,
          padding,
        )
        node.position.x = relativePos.x
        node.position.y = relativePos.y
        ensureParentPadding(parent.id, padding)
      }
    } else {
      const rootPosition = getRootNodePosition({ x: newAbsoluteX, y: newAbsoluteY })
      node.position.x = rootPosition.x
      node.position.y = rootPosition.y
    }

    maintainPassThroughEdges(nodeId)
    refreshParentBorders()
  }

  return {
    getAbsoluteNodePosition,
    getDescendantNodes,
    getNodeRect,
    getPassThroughFraction,
    alignEdgeToNode,
    maintainPassThroughEdges,
    refreshParentBorders,
    ensureParentPadding,
    findPotentialParentId,
    moveNodeToParent,
    finalizeNodeDrag,
  }
}
