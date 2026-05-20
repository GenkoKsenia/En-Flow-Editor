import type { Ref } from 'vue'

import type { Edge, Node } from '@/domains/graph'
import { getRelativePositionWithinParent, roundCoord } from '@/domains/diagram'

type DiagramDragApi = {
  getAbsoluteNodePosition(node: Node): { x: number; y: number }
  getDescendantNodes(nodeId: string): Node[]
  beginNodeEdit(nodeId: string): Promise<boolean>
  endNodeEdit(nodeId: string): Promise<void>
  beginGroupEdit(nodeIds: string[], edgeIds: string[]): Promise<boolean>
  endGroupEdit(nodeIds: string[], edgeIds: string[]): Promise<void>
  findPotentialParentId(
    draggedNodeId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): string | null
  finalizeNodeDrag(
    nodeId: string,
    potentialParentId: string | null,
    newAbsoluteX: number,
    newAbsoluteY: number,
    padding?: number,
  ): void
  finishNodeUpdate(nodeId: string, options?: { affectedEdgeIds?: string[] }): Promise<void>
  finishGroupMove(nodeIds: string[], edgeIds: string[]): Promise<void>
  updateNode(nodeId: string, updates: Partial<Node>): void
  updateEdge(edgeId: string, updates: Partial<Edge>): void
  maintainPassThroughEdges(nodeId: string): void
}

type EditorUiDragApi = {
  setDragging(value: boolean): void
  selectNode(nodeId: string): void
  setPotentialParentId(nodeId: string | null): void
  suppressSelectionClickOnce(): void
}

type UseNodeDragOptions = {
  nodes: Ref<Node[]>
  edges: Ref<Edge[]>
  selectedNodeIds: Ref<string[]>
  selectedEdgeIds: Ref<string[]>
  zoom: Ref<number>
  isConnectionMode: Ref<boolean>
  isCommentMode: Ref<boolean>
  documentStore: DiagramDragApi
  uiStore: EditorUiDragApi
  containerPadding?: number
}

type CommentTargetDescriptor = {
  type: 'node' | 'edge'
  id: string
}

export function useNodeDrag({
  nodes,
  edges,
  selectedNodeIds,
  selectedEdgeIds,
  zoom,
  isConnectionMode,
  isCommentMode,
  documentStore,
  uiStore,
  containerPadding = 24,
}: UseNodeDragOptions) {
  const DRAG_THRESHOLD = 3

  function getAncestorIds(nodeId: string): string[] {
    const ancestors: string[] = []
    let current = nodes.value.find(item => item.id === nodeId)

    while (current?.parentId) {
      ancestors.push(current.parentId)
      current = nodes.value.find(item => item.id === current?.parentId)
    }

    return ancestors
  }

  function getGroupRootNodeIds(nodeIds: string[]): string[] {
    const selectedSet = new Set(nodeIds)
    return nodeIds.filter(nodeId => !getAncestorIds(nodeId).some(ancestorId => selectedSet.has(ancestorId)))
  }

  function getVisualGroupNodeIds(rootNodeIds: string[]): string[] {
    const ids = new Set<string>()

    rootNodeIds.forEach(rootId => {
      ids.add(rootId)
      documentStore.getDescendantNodes(rootId).forEach(node => ids.add(node.id))
    })

    return Array.from(ids)
  }

  function setCommentTransforms(targets: CommentTargetDescriptor[], deltaX: number, deltaY: number): void {
    if (targets.length === 0) return

    const targetSet = new Set(targets.map(target => `${target.type}:${target.id}`))
    document.querySelectorAll<HTMLElement>('.comment-bubble').forEach(commentElement => {
      const targetType = commentElement.dataset.commentTargetType
      const targetId = commentElement.dataset.commentTargetId
      if (!targetType || !targetId) return
      if (!targetSet.has(`${targetType}:${targetId}`)) return

      commentElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`
    })
  }

  function clearCommentTransforms(targets: CommentTargetDescriptor[]): void {
    if (targets.length === 0) return

    const targetSet = new Set(targets.map(target => `${target.type}:${target.id}`))
    document.querySelectorAll<HTMLElement>('.comment-bubble').forEach(commentElement => {
      const targetType = commentElement.dataset.commentTargetType
      const targetId = commentElement.dataset.commentTargetId
      if (!targetType || !targetId) return
      if (!targetSet.has(`${targetType}:${targetId}`)) return

      commentElement.style.removeProperty('transform')
    })
  }

  function setTemporaryTransforms(nodeIds: string[], edgeIds: string[], deltaX: number, deltaY: number): void {
    nodeIds.forEach(nodeId => {
      const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null
      if (!nodeElement) return
      nodeElement.style.setProperty('--drag-dx', `${deltaX}px`)
      nodeElement.style.setProperty('--drag-dy', `${deltaY}px`)
    })

    edgeIds.forEach(edgeId => {
      const edgeElement = document.querySelector(`[data-edge-id="${edgeId}"]`) as HTMLElement | null
      if (!edgeElement) return
      edgeElement.style.setProperty('--drag-dx', `${deltaX}px`)
      edgeElement.style.setProperty('--drag-dy', `${deltaY}px`)
    })

    setCommentTransforms([
      ...nodeIds.map(id => ({ type: 'node' as const, id })),
      ...edgeIds.map(id => ({ type: 'edge' as const, id })),
    ], deltaX, deltaY)
  }

  function clearTemporaryTransforms(nodeIds: string[], edgeIds: string[]): void {
    setTemporaryTransforms(nodeIds, edgeIds, 0, 0)

    nodeIds.forEach(nodeId => {
      const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null
      nodeElement?.style.removeProperty('--drag-dx')
      nodeElement?.style.removeProperty('--drag-dy')
    })

    edgeIds.forEach(edgeId => {
      const edgeElement = document.querySelector(`[data-edge-id="${edgeId}"]`) as HTMLElement | null
      edgeElement?.style.removeProperty('--drag-dx')
      edgeElement?.style.removeProperty('--drag-dy')
    })

    clearCommentTransforms([
      ...nodeIds.map(id => ({ type: 'node' as const, id })),
      ...edgeIds.map(id => ({ type: 'edge' as const, id })),
    ])
  }

  async function startGroupDrag(nodeId: string, event: MouseEvent): Promise<void> {
    const currentSelectedNodeIds = Array.from(new Set(selectedNodeIds.value))
    const currentSelectedEdgeIds = Array.from(new Set(selectedEdgeIds.value))
    if (!currentSelectedNodeIds.includes(nodeId) || currentSelectedNodeIds.length < 2) {
      return
    }

    const locked = await documentStore.beginGroupEdit(currentSelectedNodeIds, currentSelectedEdgeIds)
    if (!locked) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    uiStore.setDragging(true)

    const startMouseX = event.clientX
    const startMouseY = event.clientY
    const rootNodeIds = getGroupRootNodeIds(currentSelectedNodeIds)
    const visualNodeIds = getVisualGroupNodeIds(rootNodeIds)

    const tempGroup = {
      dx: 0,
      dy: 0,
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      const scale = zoom.value || 1
      tempGroup.dx = (moveEvent.clientX - startMouseX) / scale
      tempGroup.dy = (moveEvent.clientY - startMouseY) / scale
      setTemporaryTransforms(visualNodeIds, currentSelectedEdgeIds, tempGroup.dx, tempGroup.dy)
    }

    const onMouseUp = () => {
      const deltaX = roundCoord(tempGroup.dx)
      const deltaY = roundCoord(tempGroup.dy)

      clearTemporaryTransforms(visualNodeIds, currentSelectedEdgeIds)
      uiStore.setDragging(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)

      if (deltaX !== 0 || deltaY !== 0) {
        rootNodeIds.forEach(rootNodeId => {
          const node = nodes.value.find(item => item.id === rootNodeId)
          if (!node) return

          documentStore.updateNode(rootNodeId, {
            position: {
              x: roundCoord(Math.max(0, node.position.x + deltaX)),
              y: roundCoord(Math.max(0, node.position.y + deltaY)),
            },
          })
        })

        currentSelectedEdgeIds.forEach(edgeId => {
          const edge = edges.value.find(item => item.id === edgeId)
          if (!edge) return

          documentStore.updateEdge(edgeId, {
            breakpoints: edge.breakpoints?.map(point => ({
              x: roundCoord(point.x + deltaX),
              y: roundCoord(point.y + deltaY),
            })),
            breakpointX: typeof edge.breakpointX === 'number' ? roundCoord(edge.breakpointX + deltaX) : edge.breakpointX,
            breakpointY: typeof edge.breakpointY === 'number' ? roundCoord(edge.breakpointY + deltaY) : edge.breakpointY,
          })
        })

        visualNodeIds.forEach(visualNodeId => {
          documentStore.maintainPassThroughEdges(visualNodeId)
        })

        const affectedEdgeIds = Array.from(
          new Set([
            ...currentSelectedEdgeIds,
            ...visualNodeIds.flatMap(visualNodeId => {
              const visualNode = nodes.value.find(item => item.id === visualNodeId)
              return visualNode?.passThroughEdges ?? []
            }),
          ]),
        )

        void documentStore.finishGroupMove(rootNodeIds, affectedEdgeIds)
        uiStore.suppressSelectionClickOnce()
      }

      void documentStore.endGroupEdit(currentSelectedNodeIds, currentSelectedEdgeIds)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    event.preventDefault()
    event.stopPropagation()
  }

  async function startDrag(nodeId: string, event: MouseEvent): Promise<void> {
    if (isConnectionMode.value) {
      event.preventDefault()
      return
    }

    const node = nodes.value.find(item => item.id === nodeId)
    if (!node) return

    const locked = await documentStore.beginNodeEdit(nodeId)
    if (!locked) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    uiStore.setDragging(true)
    uiStore.selectNode(nodeId)

    const startMouseX = event.clientX
    const startMouseY = event.clientY
    const absolutePos = documentStore.getAbsoluteNodePosition(node)
    const startNodeX = absolutePos.x
    const startNodeY = absolutePos.y
    const children = documentStore.getDescendantNodes(nodeId)
    const initialNodePosition = { ...node.position }
    const draggedNodeIds = [nodeId, ...children.map(child => child.id)]
    const initialPassThroughBreakpoints = new Map(
      Array.from(new Set(
        draggedNodeIds.flatMap(draggedId => {
          const draggedNode = nodes.value.find(item => item.id === draggedId)
          return draggedNode?.passThroughEdges ?? []
        }),
      )).map(edgeId => {
        const edge = edges.value.find(item => item.id === edgeId)
        return [
          edgeId,
          {
            breakpoints: edge?.breakpoints?.map(point => ({ x: point.x, y: point.y })),
            breakpointX: edge?.breakpointX,
            breakpointY: edge?.breakpointY,
          },
        ] as const
      }),
    )

    const tempNode = {
      dx: 0,
      dy: 0,
    }

    let potentialParentId: string | null = node.parentId ?? null

    const applyPreviewPosition = (absoluteX: number, absoluteY: number) => {
      if (node.parentId) {
        const parent = nodes.value.find(item => item.id === node.parentId)
        if (parent) {
          const parentAbsolute = documentStore.getAbsoluteNodePosition(parent)
          node.position = getRelativePositionWithinParent(
            { x: absoluteX, y: absoluteY },
            parentAbsolute,
            containerPadding,
          )
        } else {
          node.position = {
            x: roundCoord(Math.max(0, absoluteX)),
            y: roundCoord(Math.max(0, absoluteY)),
          }
        }
      } else {
        node.position = {
          x: roundCoord(Math.max(0, absoluteX)),
          y: roundCoord(Math.max(0, absoluteY)),
        }
      }

      draggedNodeIds.forEach(draggedId => {
        documentStore.maintainPassThroughEdges(draggedId)
      })
    }

    const restorePreviewState = () => {
      node.position = initialNodePosition

      initialPassThroughBreakpoints.forEach((breakpoint, edgeId) => {
        const edge = edges.value.find(item => item.id === edgeId)
        if (!edge) return
        edge.breakpoints = breakpoint.breakpoints?.map(point => ({ ...point }))
        edge.breakpointX = breakpoint.breakpointX
        edge.breakpointY = breakpoint.breakpointY
      })
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      const scale = zoom.value || 1
      const deltaX = (moveEvent.clientX - startMouseX) / scale
      const deltaY = (moveEvent.clientY - startMouseY) / scale

      tempNode.dx = deltaX
      tempNode.dy = deltaY

      applyPreviewPosition(
        roundCoord(Math.max(0, startNodeX + deltaX)),
        roundCoord(Math.max(0, startNodeY + deltaY)),
      )

      const currentX = startNodeX + deltaX
      const currentY = startNodeY + deltaY
      potentialParentId = documentStore.findPotentialParentId(nodeId, currentX, currentY, node.width, node.height)
      uiStore.setPotentialParentId(potentialParentId)
    }

    const onMouseUp = () => {
      const didMove = Math.abs(tempNode.dx) >= DRAG_THRESHOLD || Math.abs(tempNode.dy) >= DRAG_THRESHOLD
      const newAbsoluteX = roundCoord(Math.max(0, startNodeX + tempNode.dx))
      const newAbsoluteY = roundCoord(Math.max(0, startNodeY + tempNode.dy))

      uiStore.setDragging(false)
      uiStore.setPotentialParentId(null)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)

      if (didMove) {
        documentStore.finalizeNodeDrag(nodeId, potentialParentId, newAbsoluteX, newAbsoluteY, containerPadding)
        void documentStore.finishNodeUpdate(nodeId, {
          affectedEdgeIds: Array.from(initialPassThroughBreakpoints.keys()),
        })
      } else {
        restorePreviewState()
      }

      void documentStore.endNodeEdit(nodeId)
      if (didMove) {
        uiStore.suppressSelectionClickOnce()
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    event.preventDefault()
    event.stopPropagation()
  }

  function onNodeMouseDown(nodeId: string, event: MouseEvent): void {
    if ('isReadOnly' in documentStore && documentStore.isReadOnly) {
      return
    }

    if (event.ctrlKey || event.metaKey) {
      return
    }

    if (isConnectionMode.value || isCommentMode.value) {
      return
    }

    if (selectedNodeIds.value.length > 1 && selectedNodeIds.value.includes(nodeId)) {
      void startGroupDrag(nodeId, event)
      return
    }

    void startDrag(nodeId, event)
  }

  return {
    startDrag,
    onNodeMouseDown,
  }
}
