import type { Ref } from 'vue'

import * as DEFAULTS from '@/constants'
import type { DataFlow, Edge, Node } from '@/domains/graph'
import type { getSchemeById } from '@/domains/schemes'

import type { updateVersion } from '../api'

export type DiagramContext = {
  schemeId: Ref<string | null>
  currentVersionId: Ref<string | null>
  nodes: Ref<Node[]>
  edges: Ref<Edge[]>
  dataFlows: Ref<DataFlow[]>
  nextNodeId: Ref<number>
  nextEdgeId: Ref<number>
  nextBoundaryId: Ref<number>
  jsonError: Ref<string | null>
  jsonBuffer: Ref<string>
  isUpdatingFromState: Ref<boolean>
  isEditorFocused: Ref<boolean>
  lastSerializedJson: Ref<string>
  lastPersistedJson: Ref<string>
  isLoading: Ref<boolean>
  loadError: Ref<string | null>
  applyTimeout: Ref<number | null>
  defaults: typeof DEFAULTS
  getSchemeById: typeof getSchemeById
  updateVersion: typeof updateVersion
}
