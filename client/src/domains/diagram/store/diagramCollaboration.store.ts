import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { createSchemeHubClient } from '../api'
import type {
  SchemeHubChangesSavedEvent,
  SchemeHubCodeRequest,
  SchemeHubCodeUpdatedEvent,
  SchemeHubNewVersionCreatedEvent,
} from '../api'

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'
type VoidHandler = () => void
type LockRequest = {
  resolve: (value: boolean) => void
  timeoutId: number
}
export type DiagramOwnedLockScope = {
  kind: 'single' | 'group'
  nodes: string[]
  edges: string[]
}

function summarizeRequest(changes: SchemeHubCodeRequest) {
  return {
    blocks: changes.blocks?.length ?? 0,
    dataFlows: changes.dataFlows?.length ?? 0,
    connections: changes.connections?.length ?? 0,
    blockStyles: changes.styles?.blocks?.length ?? 0,
    connectionStyles: changes.styles?.connections?.length ?? 0,
  }
}

export const useDiagramCollaborationStore = defineStore('diagramCollaboration', () => {
  const client = createSchemeHubClient()

  const connectionStatus = ref<ConnectionStatus>('idle')
  const joinedSchemeId = ref<number | null>(null)
  const lockedElements = ref<Record<string, string>>({})
  const activeOwnedLockScope = ref<DiagramOwnedLockScope | null>(null)
  const lastRemoteEvent = ref<string | null>(null)
  const reconnectState = ref<string | null>(null)
  const lastError = ref<string | null>(null)
  const connectPromise = shallowRef<Promise<void> | null>(null)

  let initialized = false
  const unsubscribeHandlers: Array<() => void> = []
  const codeUpdatedHandlers = new Set<(payload: SchemeHubCodeUpdatedEvent) => void>()
  const requestUpdatesHandlers = new Set<(schemeId: number) => void>()
  const newVersionCreatedHandlers = new Set<(payload: SchemeHubNewVersionCreatedEvent) => void>()
  const changesSavedHandlers = new Set<(payload: SchemeHubChangesSavedEvent) => void>()
  const pendingLockRequests = new Map<string, LockRequest>()

  function lockKey(elementType: string, elementId: string): string {
    return `${elementType}:${elementId}`
  }

  function normalizeOwnedLockScope(scope: DiagramOwnedLockScope): DiagramOwnedLockScope {
    return {
      kind: scope.kind,
      nodes: Array.from(new Set(scope.nodes)).sort(),
      edges: Array.from(new Set(scope.edges)).sort(),
    }
  }

  function getOwnedLockScopeEntries(scope: DiagramOwnedLockScope): Array<{ elementType: string; elementId: string }> {
    return [
      ...scope.edges.map(elementId => ({ elementType: 'connection', elementId })),
      ...scope.nodes.map(elementId => ({ elementType: 'block', elementId })),
    ]
  }

  function clearSelfLockLocally(elementType: string, elementId: string): void {
    const key = lockKey(elementType, elementId)
    if (lockedElements.value[key] === 'self') {
      delete lockedElements.value[key]
    }
  }

  function readString(payload: Record<string, unknown>, pascalKey: string, camelKey: string): string {
    const value = payload[pascalKey] ?? payload[camelKey]
    return typeof value === 'string' ? value : ''
  }

  function readNumber(payload: Record<string, unknown>, pascalKey: string, camelKey: string): number | null {
    const value = payload[pascalKey] ?? payload[camelKey]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }

  function normalizeCodeUpdatedEvent(payload: SchemeHubCodeUpdatedEvent): SchemeHubCodeUpdatedEvent {
    const raw = payload as unknown as Record<string, unknown>
    return {
      SchemeId: readNumber(raw, 'SchemeId', 'schemeId') ?? 0,
      VersionId: readNumber(raw, 'VersionId', 'versionId') ?? 0,
      Changes: (raw.Changes ?? raw.changes ?? {}) as SchemeHubCodeRequest,
      UserSid: readString(raw, 'UserSid', 'userSid'),
      Timestamp: readString(raw, 'Timestamp', 'timestamp'),
    }
  }

  function normalizeChangesSavedEvent(payload: SchemeHubChangesSavedEvent): SchemeHubChangesSavedEvent {
    const raw = payload as unknown as Record<string, unknown>
    return {
      SchemeId: readNumber(raw, 'SchemeId', 'schemeId') ?? 0,
      VersionId: readNumber(raw, 'VersionId', 'versionId') ?? 0,
      SavedAt: readString(raw, 'SavedAt', 'savedAt'),
    }
  }

  function normalizeNewVersionCreatedEvent(payload: SchemeHubNewVersionCreatedEvent): SchemeHubNewVersionCreatedEvent {
    const raw = payload as unknown as Record<string, unknown>
    return {
      SchemeId: readNumber(raw, 'SchemeId', 'schemeId') ?? 0,
      Version: (raw.Version ?? raw.version ?? null) as SchemeHubNewVersionCreatedEvent['Version'],
    }
  }

  function normalizeLockPayload(payload: unknown): { elementType: string; elementId: string; lockedBy?: string } {
    const raw = payload as Record<string, unknown>
    return {
      elementType: readString(raw, 'ElementType', 'elementType'),
      elementId: readString(raw, 'ElementId', 'elementId'),
      lockedBy: readString(raw, 'LockedBy', 'lockedBy') || undefined,
    }
  }

  function settleLockRequest(elementType: string, elementId: string, granted: boolean): void {
    const key = lockKey(elementType, elementId)
    const request = pendingLockRequests.get(key)
    if (!request) return

    window.clearTimeout(request.timeoutId)
    pendingLockRequests.delete(key)
    request.resolve(granted)
  }

  function initializeSubscriptions(): void {
    if (initialized) return
    initialized = true

    unsubscribeHandlers.push(
      client.onCodeUpdated(payload => {
        const normalizedPayload = normalizeCodeUpdatedEvent(payload)
        lastRemoteEvent.value = `CodeUpdated:${normalizedPayload.VersionId}`
        codeUpdatedHandlers.forEach(handler => {
          try {
            handler(normalizedPayload)
          } catch (error) {
            lastError.value = error instanceof Error ? error.message : 'Не удалось применить remote changes'
          }
        })
      }),
      client.onChangesSaved(payload => {
        const normalizedPayload = normalizeChangesSavedEvent(payload)
        lastRemoteEvent.value = `ChangesSaved:${normalizedPayload.VersionId}`
        changesSavedHandlers.forEach(handler => handler(normalizedPayload))
      }),
      client.onElementLocked(payload => {
        const normalizedPayload = normalizeLockPayload(payload)
        if (!normalizedPayload.elementType || !normalizedPayload.elementId) return
        lockedElements.value[lockKey(normalizedPayload.elementType, normalizedPayload.elementId)] = 'locked'
        lastRemoteEvent.value = `ElementLocked:${normalizedPayload.elementType}:${normalizedPayload.elementId}`
        settleLockRequest(normalizedPayload.elementType, normalizedPayload.elementId, false)
      }),
      client.onElementLockedByUser(payload => {
        const normalizedPayload = normalizeLockPayload(payload)
        if (!normalizedPayload.elementType || !normalizedPayload.elementId) return
        lockedElements.value[lockKey(normalizedPayload.elementType, normalizedPayload.elementId)] = normalizedPayload.lockedBy ?? 'locked'
        lastRemoteEvent.value = `ElementLockedByUser:${normalizedPayload.elementType}:${normalizedPayload.elementId}`
      }),
      client.onElementLockAcquired(payload => {
        const normalizedPayload = normalizeLockPayload(payload)
        if (!normalizedPayload.elementType || !normalizedPayload.elementId) return
        lockedElements.value[lockKey(normalizedPayload.elementType, normalizedPayload.elementId)] = 'self'
        lastRemoteEvent.value = `ElementLockAcquired:${normalizedPayload.elementType}:${normalizedPayload.elementId}`
        settleLockRequest(normalizedPayload.elementType, normalizedPayload.elementId, true)
      }),
      client.onElementUnlocked(payload => {
        const normalizedPayload = normalizeLockPayload(payload)
        if (!normalizedPayload.elementType || !normalizedPayload.elementId) return
        delete lockedElements.value[lockKey(normalizedPayload.elementType, normalizedPayload.elementId)]
        lastRemoteEvent.value = `ElementUnlocked:${normalizedPayload.elementType}:${normalizedPayload.elementId}`
      }),
      client.onCannotUnlock(() => {
        lastRemoteEvent.value = 'CannotUnlock'
      }),
      client.onUpdatesSubmitted(schemeId => {
        lastRemoteEvent.value = `UpdatesSubmitted:${schemeId}`
      }),
      client.onRequestUpdates(schemeId => {
        lastRemoteEvent.value = `RequestUpdates:${schemeId}`
        requestUpdatesHandlers.forEach(handler => handler(schemeId))
      }),
      client.onNewVersionCreated(payload => {
        const normalizedPayload = normalizeNewVersionCreatedEvent(payload)
        lastRemoteEvent.value = `NewVersionCreated:${normalizedPayload.SchemeId}:${normalizedPayload.Version?.id ?? ''}`
        newVersionCreatedHandlers.forEach(handler => handler(normalizedPayload))
      }),
      client.onReconnecting(error => {
        connectionStatus.value = 'reconnecting'
        reconnectState.value = error?.message ?? 'reconnecting'
      }),
      client.onReconnected(() => {
        connectionStatus.value = 'connected'
        reconnectState.value = null
        if (joinedSchemeId.value !== null) {
          void client.joinScheme(joinedSchemeId.value)
            .then(() => {
              lastRemoteEvent.value = `RejoinScheme:${joinedSchemeId.value}`
            })
            .catch(error => {
              lastError.value = error instanceof Error ? error.message : 'Не удалось переподключить realtime-сессию'
            })
        }
      }),
      client.onClose(error => {
        connectionStatus.value = 'idle'
        activeOwnedLockScope.value = null
        lockedElements.value = {}
        if (error) {
          lastError.value = error.message
        }
        pendingLockRequests.forEach(request => {
          window.clearTimeout(request.timeoutId)
          request.resolve(false)
        })
        pendingLockRequests.clear()
      }),
    )
  }

  async function connect(): Promise<void> {
    if (connectionStatus.value === 'connected') return

    if (connectPromise.value) {
      await connectPromise.value
      return
    }

    connectionStatus.value = 'connecting'
    lastError.value = null
    initializeSubscriptions()

    connectPromise.value = (async () => {
      try {
        await client.start()
        connectionStatus.value = 'connected'
      } catch (error) {
        connectionStatus.value = 'error'
        lastError.value = error instanceof Error ? error.message : 'Не удалось подключиться к realtime'
        throw error
      } finally {
        connectPromise.value = null
      }
    })()

    await connectPromise.value
  }

  async function disconnect(): Promise<void> {
    if (joinedSchemeId.value !== null) {
      await leaveScheme(joinedSchemeId.value)
    }

    await client.stop()
    connectionStatus.value = 'idle'
    reconnectState.value = null
  }

  async function joinScheme(schemeId: number): Promise<void> {
    if (!Number.isFinite(schemeId)) return

    if (joinedSchemeId.value === schemeId && connectionStatus.value === 'connected') {
      return
    }

    if (joinedSchemeId.value !== null && joinedSchemeId.value !== schemeId) {
      await leaveScheme(joinedSchemeId.value)
    }

    await connect()
    await client.joinScheme(schemeId)
    joinedSchemeId.value = schemeId
    lastRemoteEvent.value = `JoinScheme:${schemeId}`
  }

  async function leaveScheme(schemeId: number): Promise<void> {
    if (!Number.isFinite(schemeId)) return

    try {
      if (connectionStatus.value === 'connected') {
        await releaseActiveOwnedLockScope(schemeId)
        await client.leaveScheme(schemeId)
      }
    } finally {
      if (joinedSchemeId.value === schemeId) {
        joinedSchemeId.value = null
      }
      activeOwnedLockScope.value = null
      lockedElements.value = {}
      lastRemoteEvent.value = `LeaveScheme:${schemeId}`
    }
  }

  async function sendChanges(schemeId: number, changes: SchemeHubCodeRequest): Promise<void> {
    const summary = summarizeRequest(changes)
    console.debug('[diagram-collab] sendChanges:start', {
      schemeId,
      connectionStatus: connectionStatus.value,
      joinedSchemeId: joinedSchemeId.value,
      summary,
    })

    try {
      await client.sendChanges(schemeId, changes)
      console.debug('[diagram-collab] sendChanges:success', {
        schemeId,
        connectionStatus: connectionStatus.value,
        joinedSchemeId: joinedSchemeId.value,
        summary,
      })
    } catch (error) {
      console.error('[diagram-collab] sendChanges:error', {
        schemeId,
        connectionStatus: connectionStatus.value,
        joinedSchemeId: joinedSchemeId.value,
        summary,
        error,
      })
      throw error
    }
  }

  async function lockElement(schemeId: number, elementType: string, elementId: string): Promise<void> {
    await client.lockElement(schemeId, elementType, elementId)
  }

  async function acquireElementLock(schemeId: number, elementType: string, elementId: string): Promise<boolean> {
    const owner = getElementLockOwner(elementType, elementId)
    if (owner === 'self') return true
    if (owner && owner !== 'self') return false

    initializeSubscriptions()

    const key = lockKey(elementType, elementId)
    if (pendingLockRequests.has(key)) return false

    return await new Promise(resolve => {
      const timeoutId = window.setTimeout(() => {
        pendingLockRequests.delete(key)
        resolve(false)
      }, 2000)

      pendingLockRequests.set(key, {
        resolve,
        timeoutId,
      })

      void client.lockElement(schemeId, elementType, elementId).catch(error => {
        window.clearTimeout(timeoutId)
        pendingLockRequests.delete(key)
        lastError.value = error instanceof Error ? error.message : 'Не удалось заблокировать элемент'
        resolve(false)
      })
    })
  }

  async function unlockElement(schemeId: number, elementType: string, elementId: string): Promise<void> {
    await client.unlockElement(schemeId, elementType, elementId)
  }

  async function releaseElementLock(schemeId: number, elementType: string, elementId: string): Promise<void> {
    if (!isLockedBySelf(elementType, elementId)) return
    clearSelfLockLocally(elementType, elementId)

    try {
      await unlockElement(schemeId, elementType, elementId)
    } catch (error) {
      lockedElements.value[lockKey(elementType, elementId)] = 'self'
      throw error
    }
  }

  async function releaseActiveOwnedLockScope(schemeId: number): Promise<void> {
    const scope = getActiveOwnedLockScope()
    if (!scope) return

    activeOwnedLockScope.value = null

    for (const entry of getOwnedLockScopeEntries(scope)) {
      await releaseElementLock(schemeId, entry.elementType, entry.elementId)
    }
  }

  async function submitSchemeUpdates(schemeId: number, changes: SchemeHubCodeRequest): Promise<void> {
    await client.submitSchemeUpdates(schemeId, changes)
  }

  function onCodeUpdated(handler: (payload: SchemeHubCodeUpdatedEvent) => void): VoidHandler {
    initializeSubscriptions()
    codeUpdatedHandlers.add(handler)
    return () => {
      codeUpdatedHandlers.delete(handler)
    }
  }

  function onRequestUpdates(handler: (schemeId: number) => void): VoidHandler {
    initializeSubscriptions()
    requestUpdatesHandlers.add(handler)
    return () => {
      requestUpdatesHandlers.delete(handler)
    }
  }

  function onNewVersionCreated(handler: (payload: SchemeHubNewVersionCreatedEvent) => void): VoidHandler {
    initializeSubscriptions()
    newVersionCreatedHandlers.add(handler)
    return () => {
      newVersionCreatedHandlers.delete(handler)
    }
  }

  function onChangesSaved(handler: (payload: SchemeHubChangesSavedEvent) => void): VoidHandler {
    initializeSubscriptions()
    changesSavedHandlers.add(handler)
    return () => {
      changesSavedHandlers.delete(handler)
    }
  }

  function getElementLockOwner(elementType: string, elementId: string): string | null {
    return lockedElements.value[lockKey(elementType, elementId)] ?? null
  }

  function getActiveOwnedLockScope(): DiagramOwnedLockScope | null {
    const scope = activeOwnedLockScope.value
    if (!scope) return null

    return {
      kind: scope.kind,
      nodes: [...scope.nodes],
      edges: [...scope.edges],
    }
  }

  function setActiveOwnedLockScope(scope: DiagramOwnedLockScope): void {
    activeOwnedLockScope.value = normalizeOwnedLockScope(scope)
  }

  function clearActiveOwnedLockScope(): void {
    activeOwnedLockScope.value = null
  }

  function isLockedBySelf(elementType: string, elementId: string): boolean {
    return getElementLockOwner(elementType, elementId) === 'self'
  }

  function isLockedByOther(elementType: string, elementId: string): boolean {
    const owner = getElementLockOwner(elementType, elementId)
    return owner !== null && owner !== 'self'
  }

  return {
    connectionStatus,
    joinedSchemeId,
    lockedElements,
    activeOwnedLockScope,
    lastRemoteEvent,
    reconnectState,
    lastError,
    connect,
    disconnect,
    joinScheme,
    leaveScheme,
    sendChanges,
    lockElement,
    acquireElementLock,
    unlockElement,
    releaseElementLock,
    releaseActiveOwnedLockScope,
    submitSchemeUpdates,
    initializeSubscriptions,
    onCodeUpdated,
    onRequestUpdates,
    onNewVersionCreated,
    onChangesSaved,
    getElementLockOwner,
    getActiveOwnedLockScope,
    setActiveOwnedLockScope,
    clearActiveOwnedLockScope,
    isLockedBySelf,
    isLockedByOther,
  }
})
