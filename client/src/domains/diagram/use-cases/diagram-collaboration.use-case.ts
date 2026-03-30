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
import type { useDiagramCollaborationStore } from '../store/diagramCollaboration.store'

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
    const style = getSnapshot().styles?.blocks?.find(item => item.element_id === blockId)
    if (!style?.element_id) return null

    return {
      element_id: style.element_id,
      element_type: 'block',
      color: style.color,
      border_color: style.border_color,
      border_width: style.border_width,
      border_style: style.border_style,
    }
  }

  function getConnectionStyle(connectionId: string): SchemeHubConnectionStyleChange['connectionStyle'] | null {
    const style = getSnapshot().styles?.connections?.find(item => item.element_id === connectionId)
    if (!style?.element_id) return null

    return {
      element_id: style.element_id,
      element_type: 'connection',
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

    await collaborationStore.sendChanges(schemeId, request)
    queuePendingUpdate(request)
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

  async function beginEdit(elementType: DiagramEditableElementType, elementId: string): Promise<boolean> {
    const schemeId = getNumericSchemeId()
    if (!schemeId || !collaborationStore) return true
    return await collaborationStore.acquireElementLock(schemeId, elementType, elementId)
  }

  async function endEdit(elementType: DiagramEditableElementType, elementId: string): Promise<void> {
    const schemeId = getNumericSchemeId()
    if (!schemeId || !collaborationStore) return
    await collaborationStore.releaseElementLock(schemeId, elementType, elementId)
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
            element_id: node.id,
            element_type: 'block',
          }),
        ],
        connections: deletedEdges.length
          ? deletedEdges.map(edge =>
              createConnectionStyleChange(actionType, {
                element_id: edge.id,
                element_type: 'connection',
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
            element_id: edge.id,
            element_type: 'connection',
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

  return {
    connectCollaboration,
    disconnectCollaboration,
    beginNodeEdit,
    beginEdgeEdit,
    endNodeEdit,
    endEdgeEdit,
    finishNodeCreate,
    finishNodeUpdate,
    finishNodeDelete,
    finishEdgeCreate,
    finishEdgeUpdate,
    finishEdgeDelete,
    finishDataFlowsUpdate,
    flushPendingUpdatesOnRequest,
    handleNewVersionCreated,
  }
}
