import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import * as DEFAULTS from '@/constants'
import { MOCK_CURRENT_USER_NAME } from '@/mocks'
import type { DataFlow, Edge, Node } from '@/domains/graph'
import { getSchemeById } from '@/domains/schemes'

import { createEmptyEditorDocument, updateVersion } from '../index'
import type { EditorComment } from '../index'
import {
  createDocumentCommentsUseCases,
  createDocumentCountersUseCases,
  createDocumentDataFlowsUseCases,
  createDocumentEdgesUseCases,
  createDocumentJsonUseCases,
  createDocumentLoadingUseCases,
  createDocumentNodesUseCases,
  createDocumentParentingUseCases,
  type EditorDocumentContext,
} from '../use-cases'

function getDefaultAuthor(): string {
  return MOCK_CURRENT_USER_NAME
}

export const useEditorDocumentStore = defineStore('editorDocument', () => {
  const defaultDocument = createEmptyEditorDocument()

  const schemeId = ref<string | null>(null)
  const currentVersionId = ref<string | null>(null)
  const nodes = ref<Node[]>(defaultDocument.nodes)
  const edges = ref<Edge[]>(defaultDocument.edges)
  const dataFlows = ref<DataFlow[]>(defaultDocument.dataFlows)
  const comments = ref<EditorComment[]>(defaultDocument.comments)
  const nextNodeId = ref(3)
  const nextEdgeId = ref(2)
  const nextBoundaryId = ref(1)
  const nextCommentId = ref(1)
  const jsonError = ref<string | null>(null)
  const jsonBuffer = ref('')
  const isUpdatingFromState = ref(false)
  const isEditorFocused = ref(false)
  const lastSerializedJson = ref('')
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  const applyTimeout = ref<number | null>(null)
  const isDirty = computed(() => jsonBuffer.value !== lastSerializedJson.value)

  const context: EditorDocumentContext = {
    schemeId,
    currentVersionId,
    nodes,
    edges,
    dataFlows,
    comments,
    nextNodeId,
    nextEdgeId,
    nextBoundaryId,
    nextCommentId,
    jsonError,
    jsonBuffer,
    isUpdatingFromState,
    isEditorFocused,
    lastSerializedJson,
    isLoading,
    loadError,
    applyTimeout,
    defaults: DEFAULTS,
    getDefaultAuthor,
    getSchemeById,
    updateVersion,
  }

  const countersUseCases = createDocumentCountersUseCases(context)
  const dataFlowUseCases = createDocumentDataFlowsUseCases(context)
  const commentsUseCases = createDocumentCommentsUseCases(context)
  const parentingUseCases = createDocumentParentingUseCases(context)
  const jsonUseCases = createDocumentJsonUseCases(context, {
    buildNodeSendableData: dataFlowUseCases.buildNodeSendableData,
    refreshCounters: countersUseCases.refreshCounters,
  })
  const loadingUseCases = createDocumentLoadingUseCases(context, {
    resetDocument: jsonUseCases.resetDocument,
    setDocumentFromServer: jsonUseCases.setDocumentFromServer,
    serializeDocument: jsonUseCases.serializeDocument,
    applyParsedDiagram: jsonUseCases.applyParsedDiagram,
    syncJsonFromState: jsonUseCases.syncJsonFromState,
  })
  const nodesUseCases = createDocumentNodesUseCases(context, {
    ensureFlowsForInformation: dataFlowUseCases.ensureFlowsForInformation,
  })
  const edgesUseCases = createDocumentEdgesUseCases(context, {
    buildNodeSendableData: dataFlowUseCases.buildNodeSendableData,
  })

  const { buildNodeSendableData, updateDataFlows } = dataFlowUseCases
  const { createCommentId, addComment, updateComment, removeComment } = commentsUseCases
  const {
    getAbsoluteNodePosition,
    getDescendantNodes,
    getNodeRect,
    alignEdgeToNode,
    maintainPassThroughEdges,
    refreshParentBorders,
    ensureParentPadding,
    findPotentialParentId,
    moveNodeToParent,
    finalizeNodeDrag,
  } = parentingUseCases
  const {
    syncJsonFromState,
    applyJson,
    setDocumentFromServer,
    resetDocument,
    debounceApplyFromEditor,
  } = jsonUseCases
  const { loadSchemeSnapshot, saveCurrentVersion, applyRemoteChanges } = loadingUseCases
  const { addNode, addBoundary, updateNode, deleteNode } = nodesUseCases
  const { addEdge, createEdgeId, updateEdge, deleteEdge } = edgesUseCases

  function setEditorFocused(value: boolean): void {
    isEditorFocused.value = value
    if (!value) {
      syncJsonFromState()
    }
  }

  function setJsonBuffer(value: string): void {
    jsonBuffer.value = value
  }

  watch([nodes, edges, dataFlows, comments], syncJsonFromState, { deep: true, immediate: true })
  watch(jsonBuffer, (value, previousValue) => {
    if (isUpdatingFromState.value) return
    if (value === previousValue) return
    debounceApplyFromEditor()
  })

  return {
    schemeId,
    currentVersionId,
    nodes,
    edges,
    dataFlows,
    comments,
    nextNodeId,
    nextEdgeId,
    nextBoundaryId,
    nextCommentId,
    jsonError,
    jsonBuffer,
    isUpdatingFromState,
    isEditorFocused,
    lastSerializedJson,
    isLoading,
    loadError,
    isDirty,
    buildNodeSendableData,
    syncJsonFromState,
    applyJson,
    setDocumentFromServer,
    loadSchemeSnapshot,
    saveCurrentVersion,
    applyRemoteChanges,
    addNode,
    addBoundary,
    addEdge,
    createEdgeId,
    createCommentId,
    setEditorFocused,
    setJsonBuffer,
    updateNode,
    updateEdge,
    updateDataFlows,
    getAbsoluteNodePosition,
    getDescendantNodes,
    getNodeRect,
    alignEdgeToNode,
    maintainPassThroughEdges,
    refreshParentBorders,
    ensureParentPadding,
    findPotentialParentId,
    moveNodeToParent,
    finalizeNodeDrag,
    deleteNode,
    deleteEdge,
    addComment,
    updateComment,
    removeComment,
    resetDocument,
  }
})
