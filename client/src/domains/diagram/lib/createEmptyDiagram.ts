import type { DataFlow, Edge, Node } from '@/domains/graph'

export type DiagramState = {
  nodes: Node[]
  edges: Edge[]
  dataFlows: DataFlow[]
}

export function createEmptyDiagram(): DiagramState {
  return {
    nodes: [],
    edges: [],
    dataFlows: [],
  }
}
