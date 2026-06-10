export type DiagramNodeKind = 'node' | 'boundary'

type DslNodeIdMaps = {
  toDsl: Record<string, string>
  toInternal: Record<string, string>
}

const INTERNAL_NODE_ID_PATTERN = /^(node|boundary)-(.+)$/

export function parseInternalDiagramNodeId(id: string): { kind: DiagramNodeKind; suffix: string } | null {
  const match = id.match(INTERNAL_NODE_ID_PATTERN)
  if (!match) {
    return null
  }

  const [, rawKind, suffix] = match
  const kind = rawKind === 'boundary' ? 'boundary' : 'node'
  return { kind, suffix }
}

export function isInternalDiagramNodeId(id: string): boolean {
  return INTERNAL_NODE_ID_PATTERN.test(id)
}

export function buildDslNodeIdMaps(nodeIds: string[]): DslNodeIdMaps {
  const preferredCounts = nodeIds.reduce<Record<string, number>>((acc, nodeId) => {
    const preferredId = parseInternalDiagramNodeId(nodeId)?.suffix ?? nodeId
    acc[preferredId] = (acc[preferredId] ?? 0) + 1
    return acc
  }, {})

  return nodeIds.reduce<DslNodeIdMaps>((acc, nodeId) => {
    const preferredId = parseInternalDiagramNodeId(nodeId)?.suffix ?? nodeId
    const dslId = preferredCounts[preferredId] === 1 ? preferredId : nodeId

    acc.toDsl[nodeId] = dslId
    acc.toInternal[dslId] = nodeId
    return acc
  }, { toDsl: {}, toInternal: {} })
}

export function resolveDslNodeId(
  dslId: string,
  kind: DiagramNodeKind,
  existingMap: Record<string, string>,
): string {
  if (existingMap[dslId]) {
    return existingMap[dslId]
  }

  if (isInternalDiagramNodeId(dslId)) {
    return dslId
  }

  return `${kind}-${dslId}`
}
