import type { HubConnection } from '@microsoft/signalr'

import { createHubConnection } from './createHubConnection'
import type {
  SchemeHubChangesSavedEvent,
  SchemeHubCodeRequest,
  SchemeHubCodeUpdatedEvent,
  SchemeHubElementLockAcquiredEvent,
  SchemeHubElementLockedByUserEvent,
  SchemeHubElementLockedEvent,
  SchemeHubJoinResponse,
  SchemeHubNewVersionCreatedEvent,
} from './types'

type VoidHandler = () => void

export class SchemeHubClient {
  private readonly connection: HubConnection

  constructor() {
    this.connection = createHubConnection('/hubs/scheme')
  }

  get rawConnection(): HubConnection {
    return this.connection
  }

  async start(): Promise<void> {
    if (this.connection.state === 'Connected') return
    await this.connection.start()
  }

  async stop(): Promise<void> {
    if (this.connection.state === 'Disconnected') return
    await this.connection.stop()
  }

  async joinScheme(schemeId: number): Promise<SchemeHubJoinResponse> {
    return await this.connection.invoke<SchemeHubJoinResponse>('JoinScheme', schemeId)
  }

  async leaveScheme(schemeId: number): Promise<void> {
    await this.connection.invoke('LeaveScheme', schemeId)
  }

  async sendChanges(schemeId: number, changes: SchemeHubCodeRequest): Promise<void> {
    await this.connection.invoke('SendChanges', schemeId, changes)
  }

  async lockElement(schemeId: number, elementType: string, elementId: string): Promise<void> {
    await this.connection.invoke('LockElement', schemeId, elementType, elementId)
  }

  async unlockElement(schemeId: number, elementType: string, elementId: string): Promise<void> {
    await this.connection.invoke('UnlockElement', schemeId, elementType, elementId)
  }

  async submitSchemeUpdates(schemeId: number, changes: SchemeHubCodeRequest): Promise<void> {
    await this.connection.invoke('SubmitSchemeUpdates', schemeId, changes)
  }

  onCodeUpdated(handler: (payload: SchemeHubCodeUpdatedEvent) => void): VoidHandler {
    this.connection.on('CodeUpdated', handler)
    return () => this.connection.off('CodeUpdated', handler)
  }

  onChangesSaved(handler: (payload: SchemeHubChangesSavedEvent) => void): VoidHandler {
    this.connection.on('ChangesSaved', handler)
    return () => this.connection.off('ChangesSaved', handler)
  }

  onElementLocked(handler: (payload: SchemeHubElementLockedEvent) => void): VoidHandler {
    this.connection.on('ElementLocked', handler)
    return () => this.connection.off('ElementLocked', handler)
  }

  onElementLockedByUser(handler: (payload: SchemeHubElementLockedByUserEvent) => void): VoidHandler {
    this.connection.on('ElementLockedByUser', handler)
    return () => this.connection.off('ElementLockedByUser', handler)
  }

  onElementLockAcquired(handler: (payload: SchemeHubElementLockAcquiredEvent) => void): VoidHandler {
    this.connection.on('ElementLockAcquired', handler)
    return () => this.connection.off('ElementLockAcquired', handler)
  }

  onElementUnlocked(handler: (payload: SchemeHubElementLockedEvent) => void): VoidHandler {
    this.connection.on('ElementUnlocked', handler)
    return () => this.connection.off('ElementUnlocked', handler)
  }

  onCannotUnlock(handler: VoidHandler): VoidHandler {
    this.connection.on('CannotUnlock', handler)
    return () => this.connection.off('CannotUnlock', handler)
  }

  onUpdatesSubmitted(handler: (schemeId: number) => void): VoidHandler {
    this.connection.on('UpdatesSubmitted', handler)
    return () => this.connection.off('UpdatesSubmitted', handler)
  }

  onRequestUpdates(handler: (schemeId: number) => void): VoidHandler {
    this.connection.on('RequestUpdates', handler)
    return () => this.connection.off('RequestUpdates', handler)
  }

  onNewVersionCreated(handler: (payload: SchemeHubNewVersionCreatedEvent) => void): VoidHandler {
    this.connection.on('NewVersionCreated', handler)
    return () => this.connection.off('NewVersionCreated', handler)
  }

  onReconnecting(handler: (error?: Error) => void): VoidHandler {
    this.connection.onreconnecting(handler)
    return () => {
      this.connection.onreconnecting(() => undefined)
    }
  }

  onReconnected(handler: (connectionId?: string) => void): VoidHandler {
    this.connection.onreconnected(handler)
    return () => {
      this.connection.onreconnected(() => undefined)
    }
  }

  onClose(handler: (error?: Error) => void): VoidHandler {
    this.connection.onclose(handler)
    return () => {
      this.connection.onclose(() => undefined)
    }
  }
}

export function createSchemeHubClient(): SchemeHubClient {
  return new SchemeHubClient()
}
