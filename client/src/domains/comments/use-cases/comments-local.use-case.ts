import { roundCoord } from '@/domains/diagram'

import { buildCommentTargetKey } from '../lib'
import { mapCommentToHubRequest } from '../mappers'
import type { CommentTarget } from '../models'

import type { CommentsContext, DraftPatch } from './comments.context'

type CommentsLocalDependencies = {
  refreshTarget: (targetKey: ReturnType<typeof buildCommentTargetKey>) => Promise<void>
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

  async function submitDraft(commentId: string): Promise<void> {
    const comment = context.comments.value.find(item => item.id === commentId)
    if (!comment || comment.status === 'synced') return

    if (!comment.text.trim()) {
      discardDraft(commentId)
      return
    }

    if (context.activeSchemeId.value === null) {
      comment.status = 'error'
      context.loadError.value = 'Схема не выбрана'
      return
    }

    comment.status = 'sending'
    context.loadError.value = null

    try {
      await context.client.sendComment(mapCommentToHubRequest(comment, context.activeSchemeId.value))

      const targetKey = buildCommentTargetKey(comment.targetType, comment.targetId)
      context.comments.value = context.comments.value.filter(item => item.id !== commentId)
      await dependencies.refreshTarget(targetKey)
    } catch (error) {
      comment.status = 'error'
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось отправить комментарий'
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
    discardDraft,
    dismissComment,
  }
}
