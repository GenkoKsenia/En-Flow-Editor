import { roundCoord } from '@/domains/diagram'

import { mapCommentToHubRequest } from '../mappers'
import type { CommentTarget } from '../models'

import type { CommentsContext, DraftPatch } from './comments.context'

type CommentsLocalDependencies = {
  refreshComments: () => Promise<void>
}

export function createCommentsLocalUseCases(
  context: CommentsContext,
  dependencies: CommentsLocalDependencies,
) {
  function hideSyncedComment(commentId: string): void {
    if (!context.hiddenSyncedCommentIds.value.includes(commentId)) {
      context.hiddenSyncedCommentIds.value = [...context.hiddenSyncedCommentIds.value, commentId]
    }
  }

  function startDraft(
    targetType: CommentTarget,
    targetId: string | null,
    position: { x: number; y: number },
  ): string {
    const commentId = `draft-comment-${context.draftCounter.value++}`
    context.comments.value.push({
      id: commentId,
      targetType,
      targetId,
      position: {
        x: roundCoord(position.x),
        y: roundCoord(position.y),
      },
      text: '',
      authorId: context.currentAuthorId.value ?? undefined,
      author: context.getDefaultAuthor(),
      createdAt: new Date().toLocaleString('ru-RU'),
      completionDate: null,
      status: 'draft',
    })
    return commentId
  }

  function updateDraft(commentId: string, patch: DraftPatch): void {
    const comment = context.comments.value.find(item => item.id === commentId)
    if (!comment || comment.status === 'synced') return

    if (typeof patch.text === 'string') {
      comment.text = patch.text
    }

    if (patch.position) {
      comment.position = {
        x: roundCoord(patch.position.x),
        y: roundCoord(patch.position.y),
      }
    }
  }

  function getActiveScope(): { schemeId: number; versionId: number } | null {
    if (context.activeSchemeId.value === null) {
      context.loadError.value = 'Схема не выбрана'
      return null
    }

    if (context.activeVersionId.value === null) {
      context.loadError.value = 'Версия не выбрана'
      return null
    }

    return {
      schemeId: context.activeSchemeId.value,
      versionId: context.activeVersionId.value,
    }
  }

  function getSyncedComment(commentId: string) {
    const comment = context.comments.value.find(item => item.id === commentId)
    if (!comment || comment.status !== 'synced' || typeof comment.serverId !== 'number') {
      return null
    }

    return comment
  }

  function setCommentStatus(commentId: string, status: 'sending' | 'synced'): void {
    const comment = context.comments.value.find(item => item.id === commentId)
    if (!comment || comment.status === 'draft' || comment.status === 'error') return
    comment.status = status
  }

  async function submitDraft(commentId: string): Promise<void> {
    const comment = context.comments.value.find(item => item.id === commentId)
    if (!comment || comment.status === 'synced') return

    if (!comment.text.trim()) {
      discardDraft(commentId)
      return
    }

    const scope = getActiveScope()
    if (!scope) {
      comment.status = 'error'
      return
    }

    comment.status = 'sending'
    context.loadError.value = null

    try {
      await context.client.sendComment(mapCommentToHubRequest(comment, scope.schemeId, scope.versionId))

      context.comments.value = context.comments.value.filter(item => item.id !== commentId)
      await dependencies.refreshComments()
    } catch (error) {
      comment.status = 'error'
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось отправить комментарий'
    }
  }

  async function saveSyncedComment(commentId: string, patch: DraftPatch): Promise<void> {
    const comment = getSyncedComment(commentId)
    const scope = getActiveScope()
    if (!comment || !scope) return

    const hasTextChange = typeof patch.text === 'string' && patch.text !== comment.text
    const hasPositionChange = Boolean(
      patch.position
      && (patch.position.x !== comment.position.x || patch.position.y !== comment.position.y),
    )

    if (!hasTextChange && !hasPositionChange) return

    setCommentStatus(commentId, 'sending')
    context.loadError.value = null

    try {
      if (hasTextChange) {
        await context.client.updateCommentText({
          schemeId: scope.schemeId,
          versionId: scope.versionId,
          commentId: comment.serverId!,
          text: patch.text ?? comment.text,
        })
      }

      if (hasPositionChange && patch.position) {
        await context.client.updateCommentPosition({
          schemeId: scope.schemeId,
          versionId: scope.versionId,
          commentId: comment.serverId!,
          x: patch.position.x,
          y: patch.position.y,
        })
      }

      await dependencies.refreshComments()
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось сохранить комментарий'
      throw error
    } finally {
      setCommentStatus(commentId, 'synced')
    }
  }

  async function completeComment(commentId: string): Promise<void> {
    const comment = getSyncedComment(commentId)
    const scope = getActiveScope()
    if (!comment || !scope || comment.completionDate) return

    setCommentStatus(commentId, 'sending')
    context.loadError.value = null

    try {
      await context.client.completeComment({
        schemeId: scope.schemeId,
        versionId: scope.versionId,
        commentId: comment.serverId!,
      })
      await dependencies.refreshComments()
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось завершить комментарий'
      throw error
    } finally {
      setCommentStatus(commentId, 'synced')
    }
  }

  async function deleteComment(commentId: string): Promise<void> {
    const comment = context.comments.value.find(item => item.id === commentId)
    if (!comment) return

    if (comment.status !== 'synced') {
      discardDraft(commentId)
      return
    }

    const syncedComment = getSyncedComment(commentId)
    const scope = getActiveScope()
    if (!syncedComment || !scope) return

    setCommentStatus(commentId, 'sending')
    context.loadError.value = null

    try {
      await context.client.deleteComment({
        schemeId: scope.schemeId,
        versionId: scope.versionId,
        commentId: syncedComment.serverId!,
      })
      context.comments.value = context.comments.value.filter(item => item.id !== commentId)
      void dependencies.refreshComments()
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось удалить комментарий'
      throw error
    } finally {
      setCommentStatus(commentId, 'synced')
    }
  }

  function discardDraft(commentId: string): void {
    context.comments.value = context.comments.value.filter(comment => !(comment.id === commentId && comment.status !== 'synced'))
  }

  function dismissComment(commentId: string): void {
    const comment = context.comments.value.find(item => item.id === commentId)
    if (!comment) return

    if (comment.status === 'synced') {
      hideSyncedComment(commentId)
    }

    context.comments.value = context.comments.value.filter(item => item.id !== commentId)
  }

  return {
    startDraft,
    updateDraft,
    submitDraft,
    saveSyncedComment,
    completeComment,
    deleteComment,
    discardDraft,
    dismissComment,
  }
}
