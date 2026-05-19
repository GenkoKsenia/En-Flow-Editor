import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

import * as DEFAULTS from '@/constants'
import type { DataFlow, Edge, Node } from '@/domains/graph'
import { getSchemeById } from '@/domains/schemes'

import { updateVersion } from '../api'
import { createEmptyDiagram } from '../lib'
import {
  createDiagramCollaborationUseCases,
  createDiagramDslUseCases,
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
  const isReadOnly = ref(false)
  const nodes = ref<Node[]>(defaultDiagram.nodes)
  const edges = ref<Edge[]>(defaultDiagram.edges)
  const dataFlows = ref<DataFlow[]>(defaultDiagram.dataFlows)
  const nextNodeId = ref(3)
  const nextEdgeId = ref(2)
  const nextBoundaryId = ref(1)
  const jsonError = ref<string | null>(null)
  const jsonBuffer = ref('')
  const dslError = ref<string | null>(null)
  const dslBuffer = ref('')
  const isUpdatingFromDsl = ref(false)
  const isUpdatingFromState = ref(false)
  const isEditorFocused = ref(false)
  const lastSerializedJson = ref('')
  const lastPersistedJson = ref('')
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  const applyTimeout = ref<number | null>(null)
  const codeSaveTimeout = ref<number | null>(null)
  const undoStack = ref<string[]>([])
  const redoStack = ref<string[]>([])
  const isApplyingHistory = ref(false)
  const historyBatchDepth = ref(0)
  const pendingHistorySnapshot = ref<string | null>(null)
  const isDirty = computed(() => dslBuffer.value.trim().length > 0 && dslError.value !== null)

  const context: DiagramContext = {
    schemeId,
    currentVersionId,
    isReadOnly,
    nodes,
    edges,
    dataFlows,
    nextNodeId,
    nextEdgeId,
    nextBoundaryId,
    jsonError,
    jsonBuffer,
    dslError,
    dslBuffer,
    isUpdatingFromDsl,
    isUpdatingFromState,
    isEditorFocused,
    lastSerializedJson,
    lastPersistedJson,
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
  const dslUseCases = createDiagramDslUseCases(context, {
    applyParsedDiagram: jsonUseCases.applyParsedDiagram,
    applyJson: jsonUseCases.applyJson,
  })
  const versioningUseCases = createDiagramVersioningUseCases(context, {
    resetDiagram: jsonUseCases.resetDiagram,
    setDiagramFromServer: jsonUseCases.setDiagramFromServer,
    serializeDiagram: jsonUseCases.serializeDiagram,
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
  const { syncDslFromState, applyDsl, debounceApplyFromDsl } = dslUseCases
  const { loadCurrentVersion, saveCurrentVersion } = versioningUseCases
  const { applyRemoteChanges } = syncUseCases
  const {
    connectCollaboration,
    disconnectCollaboration,
    beginNodeEdit,
    beginEdgeEdit,
    endNodeEdit,
    endEdgeEdit,
    releaseActiveOwnedLockScope,
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
  const { addNode, addDatabaseNode, addBoundary, updateNode, deleteNode } = localUseCases
  const { addEdge, createEdgeId, updateEdge, deleteEdge } = localUseCases

  function setEditorFocused(value: boolean): void {
    isEditorFocused.value = value
    if (!value) {
      syncDslFromState()
    }
  }

  function setJsonBuffer(value: string): void {
    jsonBuffer.value = value
  }

  function setDslBuffer(value: string): void {
    dslBuffer.value = value
  }

  function bindCollaboration(store: ReturnType<typeof useDiagramCollaborationStore>): void {
    connectCollaboration(store)
  }

  function resetHistory(snapshot?: string | null): void {
    const nextSnapshot = snapshot ?? lastSerializedJson.value
    undoStack.value = nextSnapshot ? [nextSnapshot] : []
    redoStack.value = []
    pendingHistorySnapshot.value = null
  }

  function pushHistorySnapshot(snapshot: string): void {
    if (!snapshot) return

    if (!undoStack.value.length) {
      undoStack.value = [snapshot]
      redoStack.value = []
      return
    }

    if (undoStack.value[undoStack.value.length - 1] === snapshot) {
      return
    }

    undoStack.value = [...undoStack.value, snapshot].slice(-100)
    redoStack.value = []
  }

  function beginHistoryBatch(): void {
    historyBatchDepth.value += 1
  }

  function endHistoryBatch(): void {
    if (historyBatchDepth.value <= 0) return
    historyBatchDepth.value -= 1

    if (historyBatchDepth.value > 0) return

    const snapshot = pendingHistorySnapshot.value
    pendingHistorySnapshot.value = null
    if (snapshot) {
      pushHistorySnapshot(snapshot)
    }
  }

  function undoHistory(): void {
    if (isReadOnly.value) return
    if (undoStack.value.length < 2) return

    const currentSnapshot = undoStack.value[undoStack.value.length - 1]
    const previousSnapshot = undoStack.value[undoStack.value.length - 2]
    if (!currentSnapshot || !previousSnapshot) return

    undoStack.value = undoStack.value.slice(0, -1)
    redoStack.value = [...redoStack.value, currentSnapshot].slice(-100)
    pendingHistorySnapshot.value = null
    isApplyingHistory.value = true
    applyJson(previousSnapshot)
    isApplyingHistory.value = false
  }

  function redoHistory(): void {
    if (isReadOnly.value) return
    const nextSnapshot = redoStack.value[redoStack.value.length - 1]
    if (!nextSnapshot) return

    redoStack.value = redoStack.value.slice(0, -1)
    isApplyingHistory.value = true
    applyJson(nextSnapshot)
    isApplyingHistory.value = false
    if (undoStack.value[undoStack.value.length - 1] !== nextSnapshot) {
      undoStack.value = [...undoStack.value, nextSnapshot].slice(-100)
    }
  }

  watch([nodes, edges, dataFlows], () => {
    syncJsonFromState()
    syncDslFromState()
  }, { deep: true, immediate: true })
  watch(lastSerializedJson, value => {
    if (!value || isApplyingHistory.value) return

    if (historyBatchDepth.value > 0) {
      pendingHistorySnapshot.value = value
      return
    }

    pushHistorySnapshot(value)
  }, { immediate: true })
  watch(dslBuffer, (value, previousValue) => {
    if (isUpdatingFromDsl.value) return
    if (value === previousValue) return
    debounceApplyFromDsl()
  })
  watch(lastSerializedJson, value => {
    if (isReadOnly.value) return
    if (dslError.value) return
    if (value === lastPersistedJson.value) return

    if (codeSaveTimeout.value) {
      window.clearTimeout(codeSaveTimeout.value)
    }

    codeSaveTimeout.value = window.setTimeout(() => {
      codeSaveTimeout.value = null
      void saveCurrentVersion().catch(error => {
        loadError.value = error instanceof Error ? error.message : 'Не удалось сохранить изменения схемы'
      })
    }, 700)
  })
  watch(isReadOnly, value => {
    if (!value || !codeSaveTimeout.value) return
    window.clearTimeout(codeSaveTimeout.value)
    codeSaveTimeout.value = null
  })
  watch(schemeId, (value, previousValue) => {
    if (value === previousValue) return
    resetHistory(null)
  })

  return {
    schemeId,
    currentVersionId,
    isReadOnly,
    nodes,
    edges,
    dataFlows,
    nextNodeId,
    nextEdgeId,
    nextBoundaryId,
    jsonError,
    jsonBuffer,
    dslError,
    dslBuffer,
    isUpdatingFromState,
    isEditorFocused,
    lastSerializedJson,
    lastPersistedJson,
    isLoading,
    loadError,
    isDirty,
    undoStack,
    redoStack,
    buildNodeSendableData,
    syncJsonFromState,
    syncDslFromState,
    applyJson,
    applyDsl,
    beginHistoryBatch,
    endHistoryBatch,
    resetHistory,
    undoHistory,
    redoHistory,
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
    releaseActiveOwnedLockScope,
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
    addDatabaseNode,
    addBoundary,
    addEdge,
    createEdgeId,
    setEditorFocused,
    setJsonBuffer,
    setDslBuffer,
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
