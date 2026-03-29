import { computed, watch, type Ref } from 'vue'

import {
  buildNodeSendableData as buildNodeSendableDataMap,
  evaluateDataIntegrity as evaluateNodeDataIntegrity,
  evaluateNodeMissingTarget,
  evaluatePassThroughStatus as evaluateGraphPassThroughStatus,
  getEdgeRequiresPassThroughFlags,
} from '@/domains/editor-document'
import type { DataFlow, Edge, Node } from '@/domains/graph'

type UseEditorDiagnosticsOptions = {
  nodes: Ref<Node[]>
  edges: Ref<Edge[]>
  dataFlows: Ref<DataFlow[]>
  isDraggingBreakpoint: Ref<boolean>
  doesEdgePassThroughNode: (edge: Edge, node: Node) => boolean
  maintainPassThroughEdges: (nodeId: string | null | undefined) => void
}

export function useEditorDiagnostics({
  nodes,
  edges,
  dataFlows,
  isDraggingBreakpoint,
  doesEdgePassThroughNode,
  maintainPassThroughEdges,
}: UseEditorDiagnosticsOptions) {
  const edgeRequiresPassThrough = computed<Record<string, boolean>>(() =>
    getEdgeRequiresPassThroughFlags(nodes.value, edges.value),
  )

  const passThroughStatus = computed(() =>
    evaluateGraphPassThroughStatus(nodes.value, edges.value, doesEdgePassThroughNode),
  )

  const nodePassThroughErrors = computed(() => passThroughStatus.value.nodeErrors)
  const edgePassThroughErrors = computed(() => passThroughStatus.value.edgeErrors)
  const nodeDataErrors = computed(() => evaluateNodeDataIntegrity(nodes.value, edges.value, dataFlows.value))
  const nodeSendableData = computed(() => buildNodeSendableDataMap(nodes.value, edges.value, dataFlows.value))
  const nodeMissingTarget = computed(() => evaluateNodeMissingTarget(nodes.value, dataFlows.value))

  const nodeForbiddenOutgoing = computed(() => {
    const flags: Record<string, boolean> = {}
    nodes.value.forEach(node => {
      flags[node.id] = false
    })
    return flags
  })

  const nodeErrorMessages = computed<Record<string, string | null>>(() => {
    const messages: Record<string, string | null> = {}

    nodes.value.forEach(node => {
      let message: string | null = null

      if (nodePassThroughErrors.value[node.id]) {
        const required = node.passThroughEdges ?? []
        const missing = required.filter(edgeId => {
          const edge = edges.value.find(item => item.id === edgeId)
          if (!edge) return true
          return !doesEdgePassThroughNode(edge, node)
        })

        const missingNames = missing
          .map(edgeId => {
            const edge = edges.value.find(item => item.id === edgeId)
            return edge?.label?.trim() || edgeId
          })
          .filter(Boolean)

        const list = missingNames.join(', ')
        message = list
          ? `Через блок должен проходить поток ${list}`
          : 'Через блок должен проходить поток'
      } else if (nodeDataErrors.value[node.id]) {
        message = 'Данные из блока не доставлены всем получателям.'
      }

      messages[node.id] = message
    })

    return messages
  })

  const nodeWarningMessages = computed<Record<string, string | null>>(() => {
    const messages: Record<string, string | null> = {}

    nodes.value.forEach(node => {
      const hasError = nodeErrorMessages.value[node.id]
      messages[node.id] = !hasError && nodeMissingTarget.value[node.id]
        ? 'Есть данные без указанного получателя.'
        : null
    })

    return messages
  })

  const edgeErrorMessages = computed<Record<string, string | null>>(() => {
    const messages: Record<string, string | null> = {}

    edges.value.forEach(edge => {
      if (!edgePassThroughErrors.value[edge.id]) {
        messages[edge.id] = null
        return
      }

      const requiredBlocks = nodes.value
        .filter(node => (node.passThroughEdges ?? []).includes(edge.id))
        .filter(node => !doesEdgePassThroughNode(edge, node))
        .map(node => node.text?.trim() || node.id)

      const list = requiredBlocks.join(', ')
      messages[edge.id] = list
        ? `Поток должен проходить через блок ${list}`
        : 'Поток должен проходить через блок'
    })

    return messages
  })

  const edgeWarningMessages = computed<Record<string, string | null>>(() => {
    const messages: Record<string, string | null> = {}
    edges.value.forEach(edge => {
      messages[edge.id] = null
    })
    return messages
  })

  function alignAllPassThroughEdges(): void {
    if (isDraggingBreakpoint.value) return
    nodes.value.forEach(node => maintainPassThroughEdges(node.id))
  }

  watch(
    () => ({
      nodes: nodes.value.map(node => ({
        id: node.id,
        pass: node.passThroughEdges,
        pos: node.position,
        size: { w: node.width, h: node.height },
      })),
      edges: edges.value.map(edge => ({
        id: edge.id,
        src: edge.sourceNodeId,
        tgt: edge.targetNodeId,
        sides: [edge.sourceSide, edge.targetSide],
      })),
    }),
    () => alignAllPassThroughEdges(),
    { deep: true, immediate: true },
  )

  return {
    edgeRequiresPassThrough,
    passThroughStatus,
    nodePassThroughErrors,
    edgePassThroughErrors,
    nodeDataErrors,
    nodeSendableData,
    nodeMissingTarget,
    nodeForbiddenOutgoing,
    nodeErrorMessages,
    nodeWarningMessages,
    edgeErrorMessages,
    edgeWarningMessages,
    alignAllPassThroughEdges,
  }
}
