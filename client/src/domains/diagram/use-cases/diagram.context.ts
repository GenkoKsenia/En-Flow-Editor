import type { Ref } from 'vue'

import * as DEFAULTS from '@/constants'
import type { DataFlow, Edge, Node } from '@/domains/graph'
import type { getSchemeById } from '@/domains/schemes'

import type { updateVersion } from '../api'

export type DiagramContext = {
  schemeId: Ref<string | null>
  currentVersionId: Ref<string | null>
  isReadOnly: Ref<boolean>
  nodes: Ref<Node[]>
  edges: Ref<Edge[]>
  dataFlows: Ref<DataFlow[]>
  nextNodeId: Ref<number>
  nextEdgeId: Ref<number>
  nextBoundaryId: Ref<number>
  jsonError: Ref<string | null>
  jsonBuffer: Ref<string>
  dslError: Ref<string | null>
  dslBuffer: Ref<string>
  isUpdatingFromDsl: Ref<boolean>
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
