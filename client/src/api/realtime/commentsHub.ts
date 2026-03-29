import type { HubConnection } from '@microsoft/signalr'

import { createHubConnection } from './createHubConnection'
import type { CommentDto, CommentHubRequest } from './realtime.types'

type VoidHandler = () => void

export class CommentsHubClient {
  private readonly connection: HubConnection

  constructor() {
    this.connection = createHubConnection('/hubs/comments')
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

  async joinElementComments(schemeId: number, elementId = ''): Promise<CommentDto[]> {
    return await this.connection.invoke<CommentDto[]>('JoinElementComments', schemeId, elementId)
  }

  async leaveElementComments(schemeId: number, elementId = ''): Promise<void> {
    await this.connection.invoke('LeaveElementComments', schemeId, elementId)
  }

  async sendComment(request: CommentHubRequest): Promise<void> {
    await this.connection.invoke('SendComment', request)
  }

  onCommentAdded(handler: (payload: CommentDto) => void): VoidHandler {
    this.connection.on('CommentAdded', handler)
    return () => this.connection.off('CommentAdded', handler)
  }

  onYourCommentAdded(handler: (payload: CommentDto) => void): VoidHandler {
    this.connection.on('YourCommentAdded', handler)
    return () => this.connection.off('YourCommentAdded', handler)
  }
}

export function createCommentsHubClient(): CommentsHubClient {
  return new CommentsHubClient()
}
