import type { Edge } from '@/models/graph'
import type { EdgeGeometry } from '@/models/graph'
import type { Node } from '@/models/graph'

export type SelectedObject =
  | { type: 'node'; data: Node }
  | { type: 'edge'; data: Edge; geometry?: EdgeGeometry }
  | null
