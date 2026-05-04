import type { HubConnection } from '@microsoft/signalr'

import { createHubConnection } from '@/shared/api/realtime/createHubConnection'
import type {
  CommentAfterActionResponse,
  CommentCompleteRequest,
  CommentDeleteRequest,
  CommentDto,
  CommentHubRequest,
  CommentPositionUpdateRequest,
  CommentUpdateRequest,
  JoinCommentsRequest,
} from './types'

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

  async joinComments(request: JoinCommentsRequest): Promise<CommentDto[]> {
    return await this.connection.invoke<CommentDto[]>('JoinComments', request)
  }

  async leaveComments(schemeId: number): Promise<void> {
    await this.connection.invoke('LeaveElementComments', schemeId)
  }

  async sendComment(request: CommentHubRequest): Promise<void> {
    await this.connection.invoke('SendComment', request)
  }

  async updateCommentText(request: CommentUpdateRequest): Promise<void> {
    await this.connection.invoke('UpdateCommentText', request)
  }

  async updateCommentPosition(request: CommentPositionUpdateRequest): Promise<void> {
    await this.connection.invoke('UpdateCommentPosition', request)
  }

  async completeComment(request: CommentCompleteRequest): Promise<void> {
    await this.connection.invoke('CompleteComment', request)
  }

  async deleteComment(request: CommentDeleteRequest): Promise<void> {
    await this.connection.invoke('DeleteComment', request)
  }

  onCommentAdded(handler: (payload: CommentAfterActionResponse) => void): VoidHandler {
    this.connection.on('CommentAdded', handler)
    return () => this.connection.off('CommentAdded', handler)
  }

  onYourCommentAdded(handler: (payload: CommentAfterActionResponse) => void): VoidHandler {
    this.connection.on('YourCommentAdded', handler)
    return () => this.connection.off('YourCommentAdded', handler)
  }

  onCommentUpdated(handler: (payload: CommentDto) => void): VoidHandler {
    this.connection.on('CommentUpdated', handler)
    return () => this.connection.off('CommentUpdated', handler)
  }

  onCommentMoved(handler: (payload: CommentDto) => void): VoidHandler {
    this.connection.on('CommentMoved', handler)
    return () => this.connection.off('CommentMoved', handler)
  }

  onCommentCompleted(handler: (payload: CommentAfterActionResponse) => void): VoidHandler {
    this.connection.on('CommentCompleted', handler)
    return () => this.connection.off('CommentCompleted', handler)
  }

  onCommentDeleted(handler: (payload: number) => void): VoidHandler {
    this.connection.on('CommentDeleted', handler)
    return () => this.connection.off('CommentDeleted', handler)
  }
}

export function createCommentsHubClient(): CommentsHubClient {
  return new CommentsHubClient()
}
