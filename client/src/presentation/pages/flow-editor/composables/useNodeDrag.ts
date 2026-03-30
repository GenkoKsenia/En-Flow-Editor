import type { Ref } from 'vue'

import type { Node } from '@/domains/graph'
import { roundCoord } from '@/domains/diagram'

type DiagramDragApi = {
  getAbsoluteNodePosition(node: Node): { x: number; y: number }
  getDescendantNodes(nodeId: string): Node[]
  beginNodeEdit(nodeId: string): Promise<boolean>
  endNodeEdit(nodeId: string): Promise<void>
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
}

type EditorUiDragApi = {
  setDragging(value: boolean): void
  selectNode(nodeId: string): void
  setPotentialParentId(nodeId: string | null): void
}

type UseNodeDragOptions = {
  nodes: Ref<Node[]>
  zoom: Ref<number>
  isConnectionMode: Ref<boolean>
  isCommentMode: Ref<boolean>
  documentStore: DiagramDragApi
  uiStore: EditorUiDragApi
  containerPadding?: number
}

export function useNodeDrag({
  nodes,
  zoom,
  isConnectionMode,
  isCommentMode,
  documentStore,
  uiStore,
  containerPadding = 24,
}: UseNodeDragOptions) {
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

    const tempNode = {
      dx: 0,
      dy: 0,
    }

    let potentialParentId: string | null = null

    const onMouseMove = (moveEvent: MouseEvent) => {
      const scale = zoom.value || 1
      const deltaX = (moveEvent.clientX - startMouseX) / scale
      const deltaY = (moveEvent.clientY - startMouseY) / scale

      tempNode.dx = deltaX
      tempNode.dy = deltaY

      const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null
      if (nodeElement) {
        nodeElement.style.setProperty('--drag-dx', `${deltaX}px`)
        nodeElement.style.setProperty('--drag-dy', `${deltaY}px`)
      }

      children.forEach(child => {
        const childElement = document.querySelector(`[data-node-id="${child.id}"]`) as HTMLElement | null
        if (childElement) {
          childElement.style.setProperty('--drag-dx', `${deltaX}px`)
          childElement.style.setProperty('--drag-dy', `${deltaY}px`)
        }
      })

      const currentX = startNodeX + deltaX
      const currentY = startNodeY + deltaY
      potentialParentId = documentStore.findPotentialParentId(nodeId, currentX, currentY, node.width, node.height)
      uiStore.setPotentialParentId(potentialParentId)
    }

    const onMouseUp = () => {
      const newAbsoluteX = roundCoord(Math.max(0, startNodeX + tempNode.dx))
      const newAbsoluteY = roundCoord(Math.max(0, startNodeY + tempNode.dy))

      const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null
      if (nodeElement) {
        nodeElement.style.removeProperty('--drag-dx')
        nodeElement.style.removeProperty('--drag-dy')
      }

      children.forEach(child => {
        const childElement = document.querySelector(`[data-node-id="${child.id}"]`) as HTMLElement | null
        if (childElement) {
          childElement.style.removeProperty('--drag-dx')
          childElement.style.removeProperty('--drag-dy')
        }
      })

      uiStore.setDragging(false)
      uiStore.setPotentialParentId(null)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)

      documentStore.finalizeNodeDrag(nodeId, potentialParentId, newAbsoluteX, newAbsoluteY, containerPadding)
      void documentStore.finishNodeUpdate(nodeId, { affectedEdgeIds: [...(node.passThroughEdges ?? [])] })
      void documentStore.endNodeEdit(nodeId)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    event.preventDefault()
    event.stopPropagation()
  }

  function onNodeMouseDown(nodeId: string, event: MouseEvent): void {
    if (isConnectionMode.value || isCommentMode.value) {
      event.preventDefault()
      return
    }

    void startDrag(nodeId, event)
  }

  return {
    startDrag,
    onNodeMouseDown,
  }
}
