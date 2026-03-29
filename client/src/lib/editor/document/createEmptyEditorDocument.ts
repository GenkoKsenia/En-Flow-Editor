import type { DataFlow, Edge, EditorComment, Node } from '@/models'

export type EditorDocumentState = {
  nodes: Node[]
  edges: Edge[]
  dataFlows: DataFlow[]
  comments: EditorComment[]
}

export function createEmptyEditorDocument(): EditorDocumentState {
  return {
    nodes: [],
    edges: [],
    dataFlows: [],
    comments: [],
  }
}
