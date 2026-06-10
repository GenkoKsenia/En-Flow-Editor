import type { DataFlow, Edge, Node } from '@/domains/graph'

import {
  SchemeHubActionType,
} from '../api'
import type {
  DiagramDto,
  EditorBlockDto,
  EditorConnectionDto,
  EditorDataFlowDto,
  SchemeHubBlockChange,
  SchemeHubBlockStyleChange,
  SchemeHubCodeRequest,
  SchemeHubConnectionChange,
  SchemeHubConnectionStyleChange,
  SchemeHubDataFlowChange,
  SchemeHubNewVersionCreatedEvent,
} from '../api'
import type {
  DiagramOwnedLockScope,
  useDiagramCollaborationStore,
} from '../store/diagramCollaboration.store'

import type { DiagramContext } from './diagram.context'

type DiagramCollaborationDependencies = {
  serializeDiagram: () => DiagramDto
  applyRemoteChanges: (changes: SchemeHubCodeRequest) => void
  loadCurrentVersion: (nextSchemeId?: string | null) => Promise<void>
}

type DiagramEditableElementType = 'block' | 'connection'
type DiagramNodeUpdateOptions = {
  affectedEdgeIds?: string[]
}

type DiagramEdgeSnapshot = Pick<Edge, 'id'>
type DiagramNodeSnapshot = Pick<Node, 'id'>

type DiagramCollaborationStore = ReturnType<typeof useDiagramCollaborationStore>

function readStyleElementId(style: { elementId?: string; element_id?: string } | null | undefined): string | null {
  return style?.elementId ?? style?.element_id ?? null
}

function summarizeRequest(request: SchemeHubCodeRequest) {
  return {
    blocks: request.blocks?.length ?? 0,
    dataFlows: request.dataFlows?.length ?? 0,
    connections: request.connections?.length ?? 0,
    blockStyles: request.styles?.blocks?.length ?? 0,
    connectionStyles: request.styles?.connections?.length ?? 0,
  }
}

function normalizeLockScope(scope: DiagramOwnedLockScope): DiagramOwnedLockScope {
  return {
    kind: scope.kind,
    nodes: Array.from(new Set(scope.nodes)).sort(),
    edges: Array.from(new Set(scope.edges)).sort(),
  }
}

function areLockScopesEqual(
  first: DiagramOwnedLockScope | null,
  second: DiagramOwnedLockScope | null,
): boolean {
  if (first === second) return true
  if (!first || !second) return false

  const normalizedFirst = normalizeLockScope(first)
  const normalizedSecond = normalizeLockScope(second)

  return normalizedFirst.kind === normalizedSecond.kind
    && normalizedFirst.nodes.length === normalizedSecond.nodes.length
    && normalizedFirst.edges.length === normalizedSecond.edges.length
    && normalizedFirst.nodes.every((value, index) => value === normalizedSecond.nodes[index])
    && normalizedFirst.edges.every((value, index) => value === normalizedSecond.edges[index])
}

function cloneRequest(request: SchemeHubCodeRequest): SchemeHubCodeRequest {
  return {
    blocks: request.blocks ? [...request.blocks] : undefined,
    dataFlows: request.dataFlows ? [...request.dataFlows] : undefined,
    connections: request.connections ? [...request.connections] : undefined,
    styles: request.styles
      ? {
          blocks: request.styles.blocks ? [...request.styles.blocks] : undefined,
          connections: request.styles.connections ? [...request.styles.connections] : undefined,
        }
      : undefined,
  }
}

export function createDiagramCollaborationUseCases(
  context: DiagramContext,
  dependencies: DiagramCollaborationDependencies,
) {
  let collaborationStore: DiagramCollaborationStore | null = null
  let unsubscribeHandlers: Array<() => void> = []
  let pendingLocalUpdates: SchemeHubCodeRequest[] = []

  function getTimestamp(): string {
    return new Date().toISOString()
  }

  function getActionTypeEnum(): typeof SchemeHubActionType {
    return SchemeHubActionType
  }

  function getNumericSchemeId(): number | null {
    const value = Number(context.schemeId.value)
    return Number.isFinite(value) ? value : null
  }

  function createSingleScope(elementType: DiagramEditableElementType, elementId: string): DiagramOwnedLockScope {
    return normalizeLockScope({
      kind: 'single',
      nodes: elementType === 'block' ? [elementId] : [],
      edges: elementType === 'connection' ? [elementId] : [],
    })
  }

  function createGroupScope(nodeIds: string[], edgeIds: string[]): DiagramOwnedLockScope {
    return normalizeLockScope({
      kind: 'group',
      nodes: nodeIds,
      edges: edgeIds,
    })
  }

  function getSnapshot(): DiagramDto {
    return dependencies.serializeDiagram()
  }

  function getBlock(blockId: string): EditorBlockDto | null {
    return getSnapshot().blocks.find(block => block.id === blockId) ?? null
  }

  function getConnection(connectionId: string): EditorConnectionDto | null {
    return getSnapshot().connections.find(connection => connection.id === connectionId) ?? null
  }

  function getDataFlow(dataKey: string): EditorDataFlowDto | null {
    return getSnapshot().dataFlows.find(flow => flow.dataKey === dataKey) ?? null
  }

  function getBlockStyle(blockId: string): SchemeHubBlockStyleChange['blockStyle'] | null {
    const style = getSnapshot().styles?.blocks?.find(item => readStyleElementId(item) === blockId)
    const elementId = readStyleElementId(style)
    if (!elementId) return null

    return {
      elementId,
      elementType: 'block',
      color: style.color,
      borderColor: style.borderColor ?? style.border_color,
      borderWidth: style.borderWidth ?? style.border_width,
      borderRadius: style.borderRadius ?? style.border_radius,
      borderStyle: style.borderStyle ?? style.border_style,
    }
  }

  function getConnectionStyle(connectionId: string): SchemeHubConnectionStyleChange['connectionStyle'] | null {
    const style = getSnapshot().styles?.connections?.find(item => readStyleElementId(item) === connectionId)
    const elementId = readStyleElementId(style)
    if (!elementId) return null

    return {
      elementId,
      elementType: 'connection',
      color: style.color,
      width: style.width,
      type: style.type,
    }
  }

  function createBlockChange(
    actionType: SchemeHubActionType,
    block: EditorBlockDto,
  ): SchemeHubBlockChange {
    return {
      dateTime: getTimestamp(),
      actiontype: actionType,
      block,
    }
  }

  function createDataFlowChange(
    actionType: SchemeHubActionType,
    dataFlow: EditorDataFlowDto,
  ): SchemeHubDataFlowChange {
    return {
      dateTime: getTimestamp(),
      actionType,
      dataFlow,
    }
  }

  function createConnectionChange(
    actionType: SchemeHubActionType,
    connection: EditorConnectionDto,
  ): SchemeHubConnectionChange {
    return {
      dateTime: getTimestamp(),
      actionType,
      connection,
    }
  }

  function createBlockStyleChange(
    actionType: SchemeHubActionType,
    blockStyle: NonNullable<SchemeHubBlockStyleChange['blockStyle']>,
  ): SchemeHubBlockStyleChange {
    return {
      dateTime: getTimestamp(),
      actionType,
      blockStyle,
    }
  }

  function createConnectionStyleChange(
    actionType: SchemeHubActionType,
    connectionStyle: NonNullable<SchemeHubConnectionStyleChange['connectionStyle']>,
  ): SchemeHubConnectionStyleChange {
    return {
      dateTime: getTimestamp(),
      actionType,
      connectionStyle,
    }
  }

  function mergeRequests(requests: SchemeHubCodeRequest[]): SchemeHubCodeRequest {
    const blocks = requests.flatMap(request => request.blocks ?? [])
    const dataFlows = requests.flatMap(request => request.dataFlows ?? [])
    const connections = requests.flatMap(request => request.connections ?? [])
    const blockStyles = requests.flatMap(request => request.styles?.blocks ?? [])
    const connectionStyles = requests.flatMap(request => request.styles?.connections ?? [])

    return {
      blocks: blocks.length ? blocks : undefined,
      dataFlows: dataFlows.length ? dataFlows : undefined,
      connections: connections.length ? connections : undefined,
      styles: blockStyles.length || connectionStyles.length
        ? {
            blocks: blockStyles.length ? blockStyles : undefined,
            connections: connectionStyles.length ? connectionStyles : undefined,
          }
        : undefined,
    }
  }

  function queuePendingUpdate(request: SchemeHubCodeRequest): void {
    pendingLocalUpdates.push(cloneRequest(request))
  }

  async function sendPatch(request: SchemeHubCodeRequest): Promise<void> {
    const schemeId = getNumericSchemeId()
    if (!schemeId || !collaborationStore) return

    const summary = summarizeRequest(request)
    console.debug('[diagram] sendPatch:start', {
      schemeId,
      summary,
    })

    try {
      await collaborationStore.sendChanges(schemeId, request)
      queuePendingUpdate(request)
      console.debug('[diagram] sendPatch:success', {
        schemeId,
        summary,
      })
    } catch (error) {
      console.error('[diagram] sendPatch:error', {
        schemeId,
        summary,
        error,
      })
      throw error
    }
  }

  async function flushPendingUpdatesOnRequest(schemeId?: number): Promise<void> {
    if (!collaborationStore) return

    const currentSchemeId = getNumericSchemeId()
    if (!currentSchemeId || (schemeId && schemeId !== currentSchemeId)) return

    const merged = pendingLocalUpdates.length ? mergeRequests(pendingLocalUpdates) : {}
    await collaborationStore.submitSchemeUpdates(currentSchemeId, merged)
  }

  async function handleNewVersionCreated(payload: SchemeHubNewVersionCreatedEvent): Promise<void> {
    const currentSchemeId = getNumericSchemeId()
    if (!currentSchemeId || payload.SchemeId !== currentSchemeId) return

    pendingLocalUpdates = []
    await dependencies.loadCurrentVersion(String(payload.SchemeId))
  }

  function connectCollaboration(store: DiagramCollaborationStore): void {
    disconnectCollaboration()
    collaborationStore = store

    unsubscribeHandlers = [
      store.onCodeUpdated(payload => {
        const currentSchemeId = getNumericSchemeId()
        if (!currentSchemeId || payload.SchemeId !== currentSchemeId) return
        dependencies.applyRemoteChanges(payload.Changes)
      }),
      store.onRequestUpdates(requestedSchemeId => {
        void flushPendingUpdatesOnRequest(requestedSchemeId)
      }),
      store.onNewVersionCreated(payload => {
        void handleNewVersionCreated(payload)
      }),
    ]
  }

  function disconnectCollaboration(): void {
    unsubscribeHandlers.forEach(unsubscribe => unsubscribe())
    unsubscribeHandlers = []
    pendingLocalUpdates = []
    collaborationStore = null
  }

  async function releaseActiveOwnedLockScope(): Promise<void> {
    const schemeId = getNumericSchemeId()
    if (!schemeId || !collaborationStore) return

    await collaborationStore.releaseActiveOwnedLockScope(schemeId)
    collaborationStore.clearActiveOwnedLockScope()
  }

  async function beginEdit(elementType: DiagramEditableElementType, elementId: string): Promise<boolean> {
    const schemeId = getNumericSchemeId()
    if (!schemeId || !collaborationStore) return true

    const nextScope = createSingleScope(elementType, elementId)
    const currentScope = collaborationStore.getActiveOwnedLockScope()

    if (areLockScopesEqual(currentScope, nextScope)) {
      return await collaborationStore.acquireElementLock(schemeId, elementType, elementId)
    }

    if (currentScope) {
      await collaborationStore.releaseActiveOwnedLockScope(schemeId)
      collaborationStore.clearActiveOwnedLockScope()
    }

    const locked = await collaborationStore.acquireElementLock(schemeId, elementType, elementId)
    if (locked) {
      collaborationStore.setActiveOwnedLockScope(nextScope)
    }

    return locked
  }

  async function endEdit(elementType: DiagramEditableElementType, elementId: string): Promise<void> {
    const schemeId = getNumericSchemeId()
    if (!schemeId || !collaborationStore) return

    await collaborationStore.releaseElementLock(schemeId, elementType, elementId)

    const scope = createSingleScope(elementType, elementId)
    if (areLockScopesEqual(collaborationStore.getActiveOwnedLockScope(), scope)) {
      collaborationStore.clearActiveOwnedLockScope()
    }
  }

  async function beginNodeEdit(nodeId: string): Promise<boolean> {
    return await beginEdit('block', nodeId)
  }

  async function beginEdgeEdit(edgeId: string): Promise<boolean> {
    return await beginEdit('connection', edgeId)
  }

  async function endNodeEdit(nodeId: string): Promise<void> {
    await endEdit('block', nodeId)
  }

  async function endEdgeEdit(edgeId: string): Promise<void> {
    await endEdit('connection', edgeId)
  }

  async function beginGroupEdit(nodeIds: string[], edgeIds: string[]): Promise<boolean> {
    const schemeId = getNumericSchemeId()
    if (!schemeId || !collaborationStore) return true

    const nextScope = createGroupScope(nodeIds, edgeIds)
    const currentScope = collaborationStore.getActiveOwnedLockScope()
    if (areLockScopesEqual(currentScope, nextScope)) {
      return true
    }

    if (currentScope) {
      await collaborationStore.releaseActiveOwnedLockScope(schemeId)
      collaborationStore.clearActiveOwnedLockScope()
    }

    const uniqueNodeIds = nextScope.nodes
    const uniqueEdgeIds = nextScope.edges
    const acquiredNodes: string[] = []
    const acquiredEdges: string[] = []

    for (const nodeId of uniqueNodeIds) {
      const locked = await collaborationStore.acquireElementLock(schemeId, 'block', nodeId)
      if (!locked) {
        for (const edgeId of acquiredEdges) {
          await collaborationStore.releaseElementLock(schemeId, 'connection', edgeId)
        }
        for (const acquiredNodeId of acquiredNodes) {
          await collaborationStore.releaseElementLock(schemeId, 'block', acquiredNodeId)
        }
        return false
      }
      acquiredNodes.push(nodeId)
    }

    for (const edgeId of uniqueEdgeIds) {
      const locked = await collaborationStore.acquireElementLock(schemeId, 'connection', edgeId)
      if (!locked) {
        for (const acquiredEdgeId of acquiredEdges) {
          await collaborationStore.releaseElementLock(schemeId, 'connection', acquiredEdgeId)
        }
        for (const acquiredNodeId of acquiredNodes) {
          await collaborationStore.releaseElementLock(schemeId, 'block', acquiredNodeId)
        }
        return false
      }
      acquiredEdges.push(edgeId)
    }

    collaborationStore.setActiveOwnedLockScope(nextScope)
    return true
  }

  async function endGroupEdit(nodeIds: string[], edgeIds: string[]): Promise<void> {
    const scope = createGroupScope(nodeIds, edgeIds)

    for (const edgeId of Array.from(new Set(edgeIds))) {
      await endEdgeEdit(edgeId)
    }

    for (const nodeId of Array.from(new Set(nodeIds))) {
      await endNodeEdit(nodeId)
    }

    if (collaborationStore && areLockScopesEqual(collaborationStore.getActiveOwnedLockScope(), scope)) {
      collaborationStore.clearActiveOwnedLockScope()
    }
  }

  async function finishNodeCreate(node: DiagramNodeSnapshot): Promise<void> {
    const actionType = getActionTypeEnum().Create
    const block = getBlock(node.id)
    const blockStyle = getBlockStyle(node.id)
    if (!block) return

    await sendPatch({
      blocks: [createBlockChange(actionType, block)],
      styles: blockStyle
        ? {
            blocks: [createBlockStyleChange(actionType, blockStyle)],
          }
        : undefined,
    })
  }

  async function finishNodeUpdate(nodeId: string, options: DiagramNodeUpdateOptions = {}): Promise<void> {
    const actionType = getActionTypeEnum().Update
    const block = getBlock(nodeId)
    const blockStyle = getBlockStyle(nodeId)
    const edgeIds = Array.from(new Set(options.affectedEdgeIds ?? []))
    const connections = edgeIds
      .map(edgeId => getConnection(edgeId))
      .filter((connection): connection is EditorConnectionDto => connection !== null)
    const connectionStyles = edgeIds
      .map(edgeId => getConnectionStyle(edgeId))
      .filter((style): style is NonNullable<SchemeHubConnectionStyleChange['connectionStyle']> => style !== null)

    if (!block && !connections.length) return

    await sendPatch({
      blocks: block ? [createBlockChange(actionType, block)] : undefined,
      connections: connections.length
        ? connections.map(connection => createConnectionChange(actionType, connection))
        : undefined,
      styles: {
        blocks: blockStyle ? [createBlockStyleChange(actionType, blockStyle)] : undefined,
        connections: connectionStyles.length
          ? connectionStyles.map(style => createConnectionStyleChange(actionType, style))
          : undefined,
      },
    })
  }

  async function finishNodeDelete(
    node: DiagramNodeSnapshot,
    deletedEdges: DiagramEdgeSnapshot[] = [],
  ): Promise<void> {
    const actionType = getActionTypeEnum().Delete
    await sendPatch({
      blocks: [
        createBlockChange(actionType, {
          id: node.id,
        }),
      ],
      connections: deletedEdges.length
        ? deletedEdges.map(edge =>
            createConnectionChange(actionType, {
              id: edge.id,
            }),
          )
        : undefined,
      styles: {
        blocks: [
          createBlockStyleChange(actionType, {
            elementId: node.id,
            elementType: 'block',
          }),
        ],
        connections: deletedEdges.length
          ? deletedEdges.map(edge =>
              createConnectionStyleChange(actionType, {
                elementId: edge.id,
                elementType: 'connection',
              }),
            )
          : undefined,
      },
    })
  }

  async function finishEdgeCreate(edge: DiagramEdgeSnapshot): Promise<void> {
    const actionType = getActionTypeEnum().Create
    const connection = getConnection(edge.id)
    const connectionStyle = getConnectionStyle(edge.id)
    if (!connection) return

    await sendPatch({
      connections: [createConnectionChange(actionType, connection)],
      styles: connectionStyle
        ? {
            connections: [createConnectionStyleChange(actionType, connectionStyle)],
          }
        : undefined,
    })
  }

  async function finishEdgeUpdate(edgeId: string): Promise<void> {
    const actionType = getActionTypeEnum().Update
    const connection = getConnection(edgeId)
    const connectionStyle = getConnectionStyle(edgeId)
    if (!connection) return

    await sendPatch({
      connections: [createConnectionChange(actionType, connection)],
      styles: connectionStyle
        ? {
            connections: [createConnectionStyleChange(actionType, connectionStyle)],
          }
        : undefined,
    })
  }

  async function finishEdgeDelete(edge: DiagramEdgeSnapshot): Promise<void> {
    const actionType = getActionTypeEnum().Delete
    await sendPatch({
      connections: [
        createConnectionChange(actionType, {
          id: edge.id,
        }),
      ],
      styles: {
        connections: [
          createConnectionStyleChange(actionType, {
            elementId: edge.id,
            elementType: 'connection',
          }),
        ],
      },
    })
  }

  async function finishDataFlowsUpdate(previousFlows: DataFlow[], nextFlows: DataFlow[]): Promise<void> {
    const previousMap = new Map(previousFlows.map(flow => [flow.dataKey, flow]))
    const nextMap = new Map(nextFlows.map(flow => [flow.dataKey, flow]))
    const dataFlowChanges: SchemeHubDataFlowChange[] = []
    const actionTypeEnum = getActionTypeEnum()

    nextMap.forEach((_, dataKey) => {
      const dataFlow = getDataFlow(dataKey)
      if (!dataFlow) return

      if (!previousMap.has(dataKey)) {
        dataFlowChanges.push(createDataFlowChange(actionTypeEnum.Create, dataFlow))
        return
      }

      const previous = JSON.stringify(previousMap.get(dataKey))
      const next = JSON.stringify(nextMap.get(dataKey))
      if (previous !== next) {
        dataFlowChanges.push(createDataFlowChange(actionTypeEnum.Update, dataFlow))
      }
    })

    previousMap.forEach((flow, dataKey) => {
      if (nextMap.has(dataKey)) return
      dataFlowChanges.push(
        createDataFlowChange(actionTypeEnum.Delete, {
          dataKey: flow.dataKey,
        }),
      )
    })

    const affectedBlockIds = Array.from(
      new Set(
        [...previousFlows, ...nextFlows]
          .map(flow => flow.startBlock)
          .filter((value): value is string => Boolean(value)),
      ),
    )
    const blockChanges = affectedBlockIds
      .map(blockId => getBlock(blockId))
      .filter((block): block is EditorBlockDto => block !== null)
      .map(block => createBlockChange(actionTypeEnum.Update, block))

    if (!dataFlowChanges.length && !blockChanges.length) return

    await sendPatch({
      blocks: blockChanges.length ? blockChanges : undefined,
      dataFlows: dataFlowChanges.length ? dataFlowChanges : undefined,
    })
  }

  async function finishGroupMove(nodeIds: string[], edgeIds: string[]): Promise<void> {
    const actionType = getActionTypeEnum().Update
    const uniqueNodeIds = Array.from(new Set(nodeIds))
    const uniqueEdgeIds = Array.from(new Set(edgeIds))
    const blockChanges = uniqueNodeIds
      .map(nodeId => getBlock(nodeId))
      .filter((block): block is EditorBlockDto => block !== null)
      .map(block => createBlockChange(actionType, block))
    const connectionChanges = uniqueEdgeIds
      .map(edgeId => getConnection(edgeId))
      .filter((connection): connection is EditorConnectionDto => connection !== null)
      .map(connection => createConnectionChange(actionType, connection))

    if (!blockChanges.length && !connectionChanges.length) return

    await sendPatch({
      blocks: blockChanges.length ? blockChanges : undefined,
      connections: connectionChanges.length ? connectionChanges : undefined,
    })
  }

  return {
    connectCollaboration,
    disconnectCollaboration,
    beginNodeEdit,
    beginEdgeEdit,
    endNodeEdit,
    endEdgeEdit,
    releaseActiveOwnedLockScope,
    finishNodeCreate,
    finishNodeUpdate,
    finishNodeDelete,
    finishEdgeCreate,
    finishEdgeUpdate,
    finishEdgeDelete,
    beginGroupEdit,
    endGroupEdit,
    finishGroupMove,
    finishDataFlowsUpdate,
    flushPendingUpdatesOnRequest,
    handleNewVersionCreated,
  }
}
