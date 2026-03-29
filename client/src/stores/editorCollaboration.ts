import { ref } from 'vue'
import { defineStore } from 'pinia'

import { createSchemeHubClient } from '@/api/realtime'
import type { SchemeHubCodeRequest } from '@/api/realtime'
import { useEditorDocumentStore } from './editorDocument'

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export const useEditorCollaborationStore = defineStore('editorCollaboration', () => {
  const documentStore = useEditorDocumentStore()
  const client = createSchemeHubClient()

  const connectionStatus = ref<ConnectionStatus>('idle')
  const joinedSchemeId = ref<number | null>(null)
  const lockedElements = ref<Record<string, string>>({})
  const lastRemoteEvent = ref<string | null>(null)
  const reconnectState = ref<string | null>(null)
  const lastError = ref<string | null>(null)

  let initialized = false
  const unsubscribeHandlers: Array<() => void> = []

  function lockKey(elementType: string, elementId: string): string {
    return `${elementType}:${elementId}`
  }

  function initializeSubscriptions(): void {
    if (initialized) return
    initialized = true

    unsubscribeHandlers.push(
      client.onCodeUpdated(payload => {
        lastRemoteEvent.value = `CodeUpdated:${payload.VersionId}`
        try {
          documentStore.applyRemoteChanges(payload.Changes)
        } catch (error) {
          lastError.value = error instanceof Error ? error.message : 'Не удалось применить remote changes'
        }
      }),
      client.onChangesSaved(payload => {
        lastRemoteEvent.value = `ChangesSaved:${payload.VersionId}`
      }),
      client.onElementLocked(payload => {
        lockedElements.value[lockKey(payload.ElementType, payload.ElementId)] = 'locked'
        lastRemoteEvent.value = `ElementLocked:${payload.ElementType}:${payload.ElementId}`
      }),
      client.onElementLockedByUser(payload => {
        lockedElements.value[lockKey(payload.ElementType, payload.ElementId)] = payload.LockedBy
        lastRemoteEvent.value = `ElementLockedByUser:${payload.ElementType}:${payload.ElementId}`
      }),
      client.onElementLockAcquired(payload => {
        lockedElements.value[lockKey(payload.ElementType, payload.ElementId)] = 'self'
        lastRemoteEvent.value = `ElementLockAcquired:${payload.ElementType}:${payload.ElementId}`
      }),
      client.onElementUnlocked(payload => {
        delete lockedElements.value[lockKey(payload.ElementType, payload.ElementId)]
        lastRemoteEvent.value = `ElementUnlocked:${payload.ElementType}:${payload.ElementId}`
      }),
      client.onCannotUnlock(() => {
        lastRemoteEvent.value = 'CannotUnlock'
      }),
      client.onUpdatesSubmitted(schemeId => {
        lastRemoteEvent.value = `UpdatesSubmitted:${schemeId}`
      }),
      client.onRequestUpdates(schemeId => {
        lastRemoteEvent.value = `RequestUpdates:${schemeId}`
      }),
      client.onNewVersionCreated(() => {
        lastRemoteEvent.value = 'NewVersionCreated'
      }),
      client.onReconnecting(error => {
        connectionStatus.value = 'reconnecting'
        reconnectState.value = error?.message ?? 'reconnecting'
      }),
      client.onReconnected(() => {
        connectionStatus.value = 'connected'
        reconnectState.value = null
      }),
      client.onClose(error => {
        connectionStatus.value = 'idle'
        if (error) {
          lastError.value = error.message
        }
      }),
    )
  }

  async function connect(): Promise<void> {
    if (connectionStatus.value === 'connected' || connectionStatus.value === 'connecting') return

    connectionStatus.value = 'connecting'
    lastError.value = null
    initializeSubscriptions()

    try {
      await client.start()
      connectionStatus.value = 'connected'
    } catch (error) {
      connectionStatus.value = 'error'
      lastError.value = error instanceof Error ? error.message : 'Не удалось подключиться к realtime'
    }
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
      await client.leaveScheme(schemeId)
    } finally {
      if (joinedSchemeId.value === schemeId) {
        joinedSchemeId.value = null
      }
      lockedElements.value = {}
      lastRemoteEvent.value = `LeaveScheme:${schemeId}`
    }
  }

  async function sendChanges(schemeId: number, changes: SchemeHubCodeRequest): Promise<void> {
    await client.sendChanges(schemeId, changes)
  }

  async function lockElement(schemeId: number, elementType: string, elementId: string): Promise<void> {
    await client.lockElement(schemeId, elementType, elementId)
  }

  async function unlockElement(schemeId: number, elementType: string, elementId: string): Promise<void> {
    await client.unlockElement(schemeId, elementType, elementId)
  }

  async function submitSchemeUpdates(schemeId: number, changes: SchemeHubCodeRequest): Promise<void> {
    await client.submitSchemeUpdates(schemeId, changes)
  }

  return {
    connectionStatus,
    joinedSchemeId,
    lockedElements,
    lastRemoteEvent,
    reconnectState,
    lastError,
    connect,
    disconnect,
    joinScheme,
    leaveScheme,
    sendChanges,
    lockElement,
    unlockElement,
    submitSchemeUpdates,
    initializeSubscriptions,
  }
})
