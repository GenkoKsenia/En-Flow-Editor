import type { Edge, EdgeGeometry, Node } from '@/domains/graph'

export type SelectedObject =
  | { type: 'node'; data: Node }
  | { type: 'edge'; data: Edge; geometry?: EdgeGeometry }
  | null
