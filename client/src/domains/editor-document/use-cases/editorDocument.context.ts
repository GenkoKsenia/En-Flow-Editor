import type { Ref } from 'vue'

import * as DEFAULTS from '@/constants'
import type { DataFlow, Edge, Node } from '@/domains/graph'
import type { getSchemeById } from '@/domains/schemes'

import type { updateVersion } from '../api'
import type { EditorComment } from '../models'

export type EditorDocumentContext = {
  schemeId: Ref<string | null>
  currentVersionId: Ref<string | null>
  nodes: Ref<Node[]>
  edges: Ref<Edge[]>
  dataFlows: Ref<DataFlow[]>
  comments: Ref<EditorComment[]>
  nextNodeId: Ref<number>
  nextEdgeId: Ref<number>
  nextBoundaryId: Ref<number>
  nextCommentId: Ref<number>
  jsonError: Ref<string | null>
  jsonBuffer: Ref<string>
  isUpdatingFromState: Ref<boolean>
  isEditorFocused: Ref<boolean>
  lastSerializedJson: Ref<string>
  isLoading: Ref<boolean>
  loadError: Ref<string | null>
  applyTimeout: Ref<number | null>
  defaults: typeof DEFAULTS
  getDefaultAuthor: () => string
  getSchemeById: typeof getSchemeById
  updateVersion: typeof updateVersion
}
