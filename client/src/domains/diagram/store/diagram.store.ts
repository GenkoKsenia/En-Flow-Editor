import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import * as DEFAULTS from '@/constants'
import type { DataFlow, Edge, Node } from '@/domains/graph'
import { getSchemeById } from '@/domains/schemes'

import { updateVersion } from '../api'
import { createEmptyDiagram } from '../lib'
import {
  createDiagramCollaborationUseCases,
  createDiagramJsonUseCases,
  createDiagramLocalUseCases,
  createDiagramSyncUseCases,
  createDiagramVersioningUseCases,
  type DiagramContext,
} from '../use-cases'
import type { useDiagramCollaborationStore } from './diagramCollaboration.store'

export const useDiagramStore = defineStore('diagram', () => {
  const defaultDiagram = createEmptyDiagram()

  const schemeId = ref<string | null>(null)
  const currentVersionId = ref<string | null>(null)
  const nodes = ref<Node[]>(defaultDiagram.nodes)
  const edges = ref<Edge[]>(defaultDiagram.edges)
  const dataFlows = ref<DataFlow[]>(defaultDiagram.dataFlows)
  const nextNodeId = ref(3)
  const nextEdgeId = ref(2)
  const nextBoundaryId = ref(1)
  const jsonError = ref<string | null>(null)
  const jsonBuffer = ref('')
  const isUpdatingFromState = ref(false)
  const isEditorFocused = ref(false)
  const lastSerializedJson = ref('')
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  const applyTimeout = ref<number | null>(null)
  const isDirty = computed(() => jsonBuffer.value !== lastSerializedJson.value)

  const context: DiagramContext = {
    schemeId,
    currentVersionId,
    nodes,
    edges,
    dataFlows,
    nextNodeId,
    nextEdgeId,
    nextBoundaryId,
    jsonError,
    jsonBuffer,
    isUpdatingFromState,
    isEditorFocused,
    lastSerializedJson,
    isLoading,
    loadError,
    applyTimeout,
    defaults: DEFAULTS,
    getSchemeById,
    updateVersion,
  }

  const localUseCases = createDiagramLocalUseCases(context)
  const jsonUseCases = createDiagramJsonUseCases(context, {
    buildNodeSendableData: localUseCases.buildNodeSendableData,
    refreshCounters: localUseCases.refreshCounters,
  })
  const versioningUseCases = createDiagramVersioningUseCases(context, {
    resetDiagram: jsonUseCases.resetDiagram,
    setDiagramFromServer: jsonUseCases.setDiagramFromServer,
  })
  const syncUseCases = createDiagramSyncUseCases({
    serializeDiagram: jsonUseCases.serializeDiagram,
    applyParsedDiagram: jsonUseCases.applyParsedDiagram,
      syncJsonFromState: jsonUseCases.syncJsonFromState,
  })
  const collaborationUseCases = createDiagramCollaborationUseCases(context, {
    serializeDiagram: jsonUseCases.serializeDiagram,
    applyRemoteChanges: syncUseCases.applyRemoteChanges,
    loadCurrentVersion: versioningUseCases.loadCurrentVersion,
  })

  const { buildNodeSendableData, updateDataFlows } = localUseCases
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
  } = localUseCases
  const {
    syncJsonFromState,
    applyJson,
    setDiagramFromServer,
    resetDiagram,
    debounceApplyFromEditor,
  } = jsonUseCases
  const { loadCurrentVersion, saveCurrentVersion } = versioningUseCases
  const { applyRemoteChanges } = syncUseCases
  const {
    connectCollaboration,
    disconnectCollaboration,
    beginNodeEdit,
    beginEdgeEdit,
    endNodeEdit,
    endEdgeEdit,
    beginGroupEdit,
    endGroupEdit,
    finishNodeCreate,
    finishNodeUpdate,
    finishNodeDelete,
    finishEdgeCreate,
    finishEdgeUpdate,
    finishEdgeDelete,
    finishGroupMove,
    finishDataFlowsUpdate,
    flushPendingUpdatesOnRequest,
    handleNewVersionCreated,
  } = collaborationUseCases
  const { addNode, addBoundary, updateNode, deleteNode } = localUseCases
  const { addEdge, createEdgeId, updateEdge, deleteEdge } = localUseCases

  function setEditorFocused(value: boolean): void {
    isEditorFocused.value = value
    if (!value) {
      syncJsonFromState()
    }
  }

  function setJsonBuffer(value: string): void {
    jsonBuffer.value = value
  }

  function bindCollaboration(store: ReturnType<typeof useDiagramCollaborationStore>): void {
    connectCollaboration(store)
  }

  watch([nodes, edges, dataFlows], syncJsonFromState, { deep: true, immediate: true })
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
    nextNodeId,
    nextEdgeId,
    nextBoundaryId,
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
    setDiagramFromServer,
    loadCurrentVersion,
    saveCurrentVersion,
    applyRemoteChanges,
    connectCollaboration: bindCollaboration,
    disconnectCollaboration,
    beginNodeEdit,
    beginEdgeEdit,
    endNodeEdit,
    endEdgeEdit,
    beginGroupEdit,
    endGroupEdit,
    finishNodeCreate,
    finishNodeUpdate,
    finishNodeDelete,
    finishEdgeCreate,
    finishEdgeUpdate,
    finishEdgeDelete,
    finishGroupMove,
    finishDataFlowsUpdate,
    flushPendingUpdatesOnRequest,
    handleNewVersionCreated,
    addNode,
    addBoundary,
    addEdge,
    createEdgeId,
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
    resetDiagram,
  }
})
