import { ref } from 'vue'
import { defineStore } from 'pinia'

import { roundCoord } from '@/domains/editor-document'
import { MOCK_CURRENT_USER_NAME } from '@/mocks'

import { createCommentsRealtimeClient } from '../api'
import { buildCommentTargetKey, parseCommentTargetKey, type CommentTargetKey } from '../lib'
import {
  inferRefreshTargetKey,
  mapCommentToHubRequest,
  mapJoinedCommentList,
} from '../mappers'
import type { CommentTarget, CommentsStoreComment } from '../models'

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'
type DraftPatch = Partial<Pick<CommentsStoreComment, 'text' | 'position'>>

function matchesTarget(comment: CommentsStoreComment, targetKey: CommentTargetKey): boolean {
  const { type, targetId } = parseCommentTargetKey(targetKey)
  return comment.targetType === type && comment.targetId === targetId
}

function dedupeComments(items: CommentsStoreComment[]): CommentsStoreComment[] {
  const unique = new Map<string, CommentsStoreComment>()
  items.forEach(item => unique.set(item.id, item))
  return Array.from(unique.values())
}

export const useCommentsStore = defineStore('comments', () => {
  const client = createCommentsRealtimeClient()

  const comments = ref<CommentsStoreComment[]>([])
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  const connectionStatus = ref<ConnectionStatus>('idle')
  const activeSchemeId = ref<number | null>(null)
  const subscribedTargets = ref<CommentTargetKey[]>([])

  let draftCounter = 1
  let initialized = false
  const unsubscribeHandlers: Array<() => void> = []

  function initializeSubscriptions(): void {
    if (initialized) return
    initialized = true

    unsubscribeHandlers.push(
      client.onCommentAdded(payload => {
        const targetKey = inferRefreshTargetKey(payload, subscribedTargets.value)
        if (targetKey) {
          void refreshTarget(targetKey)
        }
      }),
      client.onYourCommentAdded(payload => {
        const targetKey = inferRefreshTargetKey(payload, subscribedTargets.value)
        if (targetKey) {
          void refreshTarget(targetKey)
        }
      }),
    )
  }

  async function ensureConnected(): Promise<void> {
    if (connectionStatus.value === 'connected' || connectionStatus.value === 'connecting') return

    initializeSubscriptions()
    connectionStatus.value = 'connecting'
    loadError.value = null

    try {
      await client.start()
      connectionStatus.value = 'connected'
    } catch (error) {
      connectionStatus.value = 'error'
      loadError.value = error instanceof Error ? error.message : 'Не удалось подключиться к comments hub'
      throw error
    }
  }

  async function joinTarget(targetKey: CommentTargetKey): Promise<void> {
    if (activeSchemeId.value === null) return

    const { type, targetId } = parseCommentTargetKey(targetKey)
    const payload = await client.joinElementComments(activeSchemeId.value, type === 'canvas' ? '' : (targetId ?? ''))
    const syncedComments = mapJoinedCommentList(payload, targetKey)
    comments.value = dedupeComments([
      ...comments.value.filter(comment => !(comment.status === 'synced' && matchesTarget(comment, targetKey))),
      ...syncedComments,
    ])
  }

  async function leaveTarget(targetKey: CommentTargetKey): Promise<void> {
    if (activeSchemeId.value === null) return

    const { type, targetId } = parseCommentTargetKey(targetKey)
    await client.leaveElementComments(activeSchemeId.value, type === 'canvas' ? '' : (targetId ?? ''))
  }

  async function initializeForScheme(schemeId: number, targets: CommentTargetKey[]): Promise<void> {
    if (!Number.isFinite(schemeId)) return

    isLoading.value = true
    loadError.value = null

    try {
      if (activeSchemeId.value !== null && activeSchemeId.value !== schemeId) {
        await reset()
      }

      activeSchemeId.value = schemeId
      await ensureConnected()
      await syncTargets(targets)
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Не удалось инициализировать комментарии'
    } finally {
      isLoading.value = false
    }
  }

  async function syncTargets(targets: CommentTargetKey[]): Promise<void> {
    if (activeSchemeId.value === null) return

    try {
      const nextTargets = Array.from(new Set(targets))
      const previousTargets = new Set(subscribedTargets.value)
      const nextTargetsSet = new Set(nextTargets)

      for (const targetKey of subscribedTargets.value) {
        if (nextTargetsSet.has(targetKey)) continue

        await leaveTarget(targetKey)
        comments.value = comments.value.filter(comment => !matchesTarget(comment, targetKey))
      }

      for (const targetKey of nextTargets) {
        if (previousTargets.has(targetKey)) continue
        await joinTarget(targetKey)
      }

      subscribedTargets.value = nextTargets
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Не удалось синхронизировать комментарии'
    }
  }

  async function refreshTarget(targetKey: CommentTargetKey): Promise<void> {
    if (!subscribedTargets.value.includes(targetKey)) return

    try {
      await joinTarget(targetKey)
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Не удалось обновить комментарии'
    }
  }

  function startDraft(
    targetType: CommentTarget,
    targetId: string | null,
    position: { x: number; y: number },
  ): string {
    const commentId = `draft-comment-${draftCounter++}`
    comments.value.push({
      id: commentId,
      targetType,
      targetId,
      position: {
        x: roundCoord(position.x),
        y: roundCoord(position.y),
      },
      text: '',
      author: MOCK_CURRENT_USER_NAME,
      createdAt: new Date().toLocaleString('ru-RU'),
      status: 'draft',
    })
    return commentId
  }

  function updateDraft(commentId: string, patch: DraftPatch): void {
    const comment = comments.value.find(item => item.id === commentId)
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
    const comment = comments.value.find(item => item.id === commentId)
    if (!comment || comment.status === 'synced') return

    if (!comment.text.trim()) {
      discardDraft(commentId)
      return
    }

    if (activeSchemeId.value === null) {
      comment.status = 'error'
      loadError.value = 'Схема не выбрана'
      return
    }

    comment.status = 'sending'
    loadError.value = null

    try {
      await client.sendComment(mapCommentToHubRequest(comment, activeSchemeId.value))
      const targetKey = buildCommentTargetKey(comment.targetType, comment.targetId)
      comments.value = comments.value.filter(item => item.id !== commentId)
      await refreshTarget(targetKey)
    } catch (error) {
      comment.status = 'error'
      loadError.value = error instanceof Error ? error.message : 'Не удалось отправить комментарий'
    }
  }

  function discardDraft(commentId: string): void {
    comments.value = comments.value.filter(comment => !(comment.id === commentId && comment.status !== 'synced'))
  }

  async function reset(): Promise<void> {
    if (activeSchemeId.value !== null) {
      for (const targetKey of subscribedTargets.value) {
        try {
          await leaveTarget(targetKey)
        } catch {
          // noop
        }
      }
    }

    try {
      await client.stop()
    } catch {
      // noop
    }

    while (unsubscribeHandlers.length) {
      unsubscribeHandlers.pop()?.()
    }

    comments.value = []
    isLoading.value = false
    loadError.value = null
    connectionStatus.value = 'idle'
    activeSchemeId.value = null
    subscribedTargets.value = []
    initialized = false
  }

  return {
    comments,
    isLoading,
    loadError,
    connectionStatus,
    activeSchemeId,
    subscribedTargets,
    initializeForScheme,
    syncTargets,
    startDraft,
    updateDraft,
    submitDraft,
    discardDraft,
    refreshTarget,
    reset,
  }
})
