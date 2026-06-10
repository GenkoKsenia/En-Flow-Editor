import type { Ref } from 'vue'

import {
  buildConnectionPositionMap,
} from '@/domains/diagram'
import type { ConnectionSide, Edge, Node } from '@/domains/graph'

type DragEndpoint = 'source' | 'target'

type DiagramEdgeOrderApi = {
  isReadOnly?: boolean
  beginHistoryBatch(): void
  endHistoryBatch(): void
  beginGroupEdit(nodeIds: string[], edgeIds: string[]): Promise<boolean>
  endGroupEdit(nodeIds: string[], edgeIds: string[]): Promise<void>
  finishGroupMove(nodeIds: string[], edgeIds: string[]): Promise<void>
}

type EditorUiEdgeOrderApi = {
  suppressSelectionClickOnce(): void
}

type UseEdgeEndpointOrderDragOptions = {
  nodes: Ref<Node[]>
  edges: Ref<Edge[]>
  zoom: Ref<number>
  canvas: Ref<HTMLElement | null>
  diagramStore: DiagramEdgeOrderApi
  uiStore: EditorUiEdgeOrderApi
  getAbsoluteNodePosition: (node: Node) => { x: number; y: number }
}

type EdgeEndpointDescriptor = {
  edgeId: string
  endpoint: DragEndpoint
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function useEdgeEndpointOrderDrag({
  nodes,
  edges,
  zoom,
  canvas,
  diagramStore,
  uiStore,
  getAbsoluteNodePosition,
}: UseEdgeEndpointOrderDragOptions) {
  function disableDocumentSelection(): () => void {
    const bodyStyle = document.body.style
    const documentElementStyle = document.documentElement.style
    const previousBodyUserSelect = bodyStyle.userSelect
    const previousBodyWebkitUserSelect = bodyStyle.getPropertyValue('-webkit-user-select')
    const previousHtmlCursor = documentElementStyle.cursor

    bodyStyle.userSelect = 'none'
    bodyStyle.setProperty('-webkit-user-select', 'none')
    documentElementStyle.cursor = 'grabbing'

    return () => {
      bodyStyle.userSelect = previousBodyUserSelect
      if (previousBodyWebkitUserSelect) {
        bodyStyle.setProperty('-webkit-user-select', previousBodyWebkitUserSelect)
      } else {
        bodyStyle.removeProperty('-webkit-user-select')
      }
      documentElementStyle.cursor = previousHtmlCursor
    }
  }

  function getPointerRatio(event: MouseEvent, node: Node, side: ConnectionSide): number | null {
    if (!canvas.value) return null

    const rect = canvas.value.getBoundingClientRect()
    const scale = zoom.value || 1
    const canvasX = (event.clientX - rect.left + canvas.value.scrollLeft) / scale
    const canvasY = (event.clientY - rect.top + canvas.value.scrollTop) / scale

    const absolutePosition = getAbsoluteNodePosition(node)

    if (side === 'top' || side === 'bottom') {
      return clamp((canvasX - absolutePosition.x) / Math.max(node.width, 1), 0, 1)
    }

    return clamp((canvasY - absolutePosition.y) / Math.max(node.height, 1), 0, 1)
  }

  function getOrderedEndpointDescriptors(nodeId: string, side: ConnectionSide): EdgeEndpointDescriptor[] {
    const connectionMap = buildConnectionPositionMap(nodes.value, edges.value)
    const orderedIds = connectionMap[nodeId]?.[side] ?? []

    return orderedIds
      .map(edgeId => {
        const edge = edges.value.find(item => item.id === edgeId)
        if (!edge) return null

        if (edge.sourceNodeId === nodeId && edge.sourceSide === side) {
          return {
            edgeId,
            endpoint: 'source' as const,
          }
        }

        if (edge.targetNodeId === nodeId && edge.targetSide === side) {
          return {
            edgeId,
            endpoint: 'target' as const,
          }
        }

        return null
      })
      .filter((descriptor): descriptor is EdgeEndpointDescriptor => descriptor !== null)
  }

  function applyEndpointOrder(
    descriptors: EdgeEndpointDescriptor[],
    draggedEdgeId: string,
    targetIndex: number,
  ): boolean {
    const currentIndex = descriptors.findIndex(item => item.edgeId === draggedEdgeId)
    if (currentIndex === -1 || currentIndex === targetIndex) return false

    const reordered = [...descriptors]
    const [dragged] = reordered.splice(currentIndex, 1)
    if (!dragged) return false
    reordered.splice(targetIndex, 0, dragged)

    reordered.forEach((descriptor, order) => {
      const edge = edges.value.find(item => item.id === descriptor.edgeId)
      if (!edge) return

      if (descriptor.endpoint === 'source') {
        edge.sourceOrder = order
        return
      }

      edge.targetOrder = order
    })

    return true
  }

  async function onEndpointOrderDragStart(
    edgeId: string,
    endpoint: DragEndpoint,
    event: MouseEvent,
  ): Promise<void> {
    if (diagramStore.isReadOnly) return

    const edge = edges.value.find(item => item.id === edgeId)
    if (!edge) return

    const nodeId = endpoint === 'source' ? edge.sourceNodeId : edge.targetNodeId
    const side = endpoint === 'source' ? edge.sourceSide : edge.targetSide
    const node = nodes.value.find(item => item.id === nodeId)
    if (!node) return

    const siblings = getOrderedEndpointDescriptors(nodeId, side)
    if (siblings.length < 2) return

    const siblingIds = siblings.map(item => item.edgeId)
    const locked = await diagramStore.beginGroupEdit([], siblingIds)
    if (!locked) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    const initialOrders = new Map(
      siblingIds.map(siblingEdgeId => {
        const sibling = edges.value.find(item => item.id === siblingEdgeId)
        return [siblingEdgeId, {
          sourceOrder: sibling?.sourceOrder,
          targetOrder: sibling?.targetOrder,
        }] as const
      }),
    )

    let hasChanges = false
    let isBatchOpen = true
    diagramStore.beginHistoryBatch()
    const restoreDocumentSelection = disableDocumentSelection()

    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault()

      const ratio = getPointerRatio(moveEvent, node, side)
      if (ratio === null) return

      const ordered = getOrderedEndpointDescriptors(nodeId, side)
      const targetIndex = clamp(
        Math.round(ratio * (ordered.length + 1)) - 1,
        0,
        ordered.length - 1,
      )

      if (applyEndpointOrder(ordered, edgeId, targetIndex)) {
        hasChanges = true
      }
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      restoreDocumentSelection()

      const hasFinalDifference = siblingIds.some(siblingEdgeId => {
        const sibling = edges.value.find(item => item.id === siblingEdgeId)
        const initial = initialOrders.get(siblingEdgeId)
        return sibling?.sourceOrder !== initial?.sourceOrder || sibling?.targetOrder !== initial?.targetOrder
      })

      if (!hasChanges || !hasFinalDifference) {
        initialOrders.forEach((orders, siblingEdgeId) => {
          const sibling = edges.value.find(item => item.id === siblingEdgeId)
          if (!sibling) return
          sibling.sourceOrder = orders.sourceOrder
          sibling.targetOrder = orders.targetOrder
        })
      } else {
        void diagramStore.finishGroupMove([], siblingIds)
        uiStore.suppressSelectionClickOnce()
      }

      void diagramStore.endGroupEdit([], siblingIds)
      if (isBatchOpen) {
        diagramStore.endHistoryBatch()
        isBatchOpen = false
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    event.preventDefault()
    event.stopPropagation()
  }

  return {
    onEndpointOrderDragStart,
  }
}
