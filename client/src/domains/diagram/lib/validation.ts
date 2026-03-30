import type { DataFlow, Edge, Node } from '@/domains/graph'

export function getEdgeRequiresPassThroughFlags(nodes: Node[], edges: Edge[]): Record<string, boolean> {
  const flags: Record<string, boolean> = {}

  edges.forEach(edge => {
    flags[edge.id] = false
  })

  nodes.forEach(node => {
    ;(node.passThroughEdges || []).forEach(edgeId => {
      flags[edgeId] = true
    })
  })

  return flags
}

export function buildDataTargetsMap(dataFlows: DataFlow[]): Record<string, string[]> {
  const map: Record<string, string[]> = {}

  dataFlows.forEach(flow => {
    map[flow.dataKey] = (flow.finishBlocks ?? []).map(dest => String(dest)).filter(Boolean)
  })

  return map
}

export function buildNodeSendableData(nodes: Node[], edges: Edge[], dataFlows: DataFlow[]): Record<string, string[]> {
  const targets = buildDataTargetsMap(dataFlows)
  const sets: Record<string, Set<string>> = {}

  nodes.forEach(node => {
    const own = new Set<string>()
    ;(node.informationIds ?? []).forEach(id => own.add(id))

    dataFlows.forEach(flow => {
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

    edges.forEach(edge => {
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

  return Object.fromEntries(Object.entries(sets).map(([nodeId, set]) => [nodeId, Array.from(set)]))
}

export function evaluateNodeMissingTarget(nodes: Node[], dataFlows: DataFlow[]): Record<string, boolean> {
  const flags: Record<string, boolean> = {}
  const flowsByStart = dataFlows.reduce<Record<string, DataFlow[]>>((acc, flow) => {
    const start = flow.startBlock
    if (!start) return acc
    if (!acc[start]) acc[start] = []
    acc[start].push(flow)
    return acc
  }, {})

  nodes.forEach(node => {
    const infos = node.informationIds ?? []
    const flows = flowsByStart[node.id] ?? []
    const relevantFlows = flows.filter(flow => !infos.length || infos.includes(flow.dataKey))
    const hasInfo = infos.length > 0 || relevantFlows.length > 0
    const missing = relevantFlows.some(flow => (flow.finishBlocks ?? []).length === 0)
    flags[node.id] = hasInfo && missing
  })

  return flags
}

export function isDataReachable(
  dataId: string,
  startNodeId: string,
  targetNodeId: string,
  targetsMap: Record<string, string[]>,
  edges: Edge[],
): boolean {
  if (startNodeId === targetNodeId) return true

  const visited = new Set<string>()
  const queue: string[] = [startNodeId]

  while (queue.length) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)

    if ((targetsMap[dataId] ?? []).includes(current)) {
      continue
    }

    const outgoing = edges.filter(edge => edge.sourceNodeId === current)
    for (const edge of outgoing) {
      const payload = edge.dataKeys ?? []
      if (!payload.includes(dataId)) continue
      const next = edge.targetNodeId
      if (next === targetNodeId) return true
      if (!visited.has(next)) queue.push(next)
    }
  }

  return false
}

export function evaluateDataIntegrity(nodes: Node[], edges: Edge[], dataFlows: DataFlow[]): Record<string, boolean> {
  const nodeErrors: Record<string, boolean> = {}
  nodes.forEach(node => { nodeErrors[node.id] = false })

  const targetsMap = buildDataTargetsMap(dataFlows)
  const nodeInfoMap: Record<string, Set<string>> = {}
  nodes.forEach(node => {
    nodeInfoMap[node.id] = new Set(node.informationIds ?? [])
  })

  dataFlows.forEach(flow => {
    const start = flow.startBlock
    if (!start) return

    const finishes = flow.finishBlocks ?? []
    if (!finishes.length) {
      nodeErrors[start] = true
      return
    }

    const startHasData = nodeInfoMap[start]?.has(flow.dataKey) ?? false
    const allReached = finishes.every(target =>
      isDataReachable(flow.dataKey, start, String(target), targetsMap, edges),
    )

    if (!allReached || !startHasData) {
      nodeErrors[start] = true
    }
  })

  return nodeErrors
}

export function evaluatePassThroughStatus(
  nodes: Node[],
  edges: Edge[],
  doesEdgePassThroughNode: (edge: Edge, node: Node) => boolean,
): { nodeErrors: Record<string, boolean>; edgeErrors: Record<string, boolean> } {
  const nodeErrors: Record<string, boolean> = {}
  const edgeErrors: Record<string, boolean> = {}

  nodes.forEach(node => {
    const requiredEdges = node.passThroughEdges || []
    if (!requiredEdges.length) {
      nodeErrors[node.id] = false
      return
    }

    let hasError = false
    requiredEdges.forEach(edgeId => {
      const edge = edges.find(item => item.id === edgeId)
      if (!edge) {
        hasError = true
        edgeErrors[edgeId] = true
        return
      }

      const passes = doesEdgePassThroughNode(edge, node)
      if (!passes) {
        hasError = true
        edgeErrors[edgeId] = true
      } else if (!(edgeId in edgeErrors)) {
        edgeErrors[edgeId] = false
      }
    })

    nodeErrors[node.id] = hasError
  })

  edges.forEach(edge => {
    if (!(edge.id in edgeErrors)) {
      edgeErrors[edge.id] = false
    }
  })

  return { nodeErrors, edgeErrors }
}
