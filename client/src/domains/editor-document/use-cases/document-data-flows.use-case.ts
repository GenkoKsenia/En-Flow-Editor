import type { DataFlow } from '@/domains/graph'

import type { EditorDocumentContext } from './editorDocument.context'

export function createDocumentDataFlowsUseCases(context: EditorDocumentContext) {
  function buildNodeSendableData(): Record<string, string[]> {
    const targets: Record<string, string[]> = {}
    context.dataFlows.value.forEach(flow => {
      targets[flow.dataKey] = (flow.finishBlocks ?? []).map(dest => String(dest)).filter(Boolean)
    })

    const sets: Record<string, Set<string>> = {}
    context.nodes.value.forEach(node => {
      const own = new Set<string>()
      ;(node.informationIds ?? []).forEach(id => own.add(id))
      context.dataFlows.value.forEach(flow => {
        if (flow.startBlock === node.id) {
          own.add(flow.dataKey)
        }
      })
      sets[node.id] = own
    })

    let changed = true
    let iterations = 0
    while (changed && iterations < 200) {
      changed = false
      iterations += 1

      context.edges.value.forEach(edge => {
        const payload = (edge.dataKeys ?? []).filter(key => !(targets[key] ?? []).includes(edge.sourceNodeId))
        const sourceSet = sets[edge.sourceNodeId]
        const targetSet = sets[edge.targetNodeId]
        if (!sourceSet || !targetSet) return

        payload.forEach(key => {
          if (!sourceSet.has(key)) return
          if ((targets[key] ?? []).includes(edge.targetNodeId)) return
          if (!targetSet.has(key)) {
            targetSet.add(key)
            changed = true
          }
        })
      })
    }

    Object.entries(sets).forEach(([nodeId, set]) => {
      Array.from(set).forEach(key => {
        if ((targets[key] ?? []).includes(nodeId)) {
          set.delete(key)
        }
      })
    })

    return Object.fromEntries(Object.entries(sets).map(([id, set]) => [id, Array.from(set)]))
  }

  function ensureFlowsForInformation(nodeId: string, infoIds: string[]): void {
    const map = new Map<string, DataFlow>()
    context.dataFlows.value.forEach(flow => map.set(flow.dataKey, { ...flow }))
    let changed = false

    infoIds.forEach(infoId => {
      const existing = map.get(infoId)
      if (existing) {
        if (!existing.startBlock) {
          existing.startBlock = nodeId
          changed = true
        }
        return
      }

      map.set(infoId, {
        dataKey: infoId,
        dataName: infoId,
        startBlock: nodeId,
        finishBlocks: [],
      })
      changed = true
    })

    if (changed) {
      context.dataFlows.value = Array.from(map.values())
    }
  }

  function updateDataFlows(newFlows: DataFlow[]): void {
    context.dataFlows.value = newFlows
    const infoByNode: Record<string, string[]> = {}
    newFlows.forEach(flow => {
      if (!flow.startBlock) return
      if (!infoByNode[flow.startBlock]) infoByNode[flow.startBlock] = []
      infoByNode[flow.startBlock].push(flow.dataKey)
    })
    context.nodes.value.forEach(node => {
      node.informationIds = infoByNode[node.id] ?? []
    })
  }

  return {
    buildNodeSendableData,
    ensureFlowsForInformation,
    updateDataFlows,
  }
}
