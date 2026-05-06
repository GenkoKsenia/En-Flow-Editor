import {
  type CommentTargetKey,
} from '../lib'
import {
  mapJoinedCommentList,
} from '../mappers'
import { resolveCommentAuthor } from '../api'
import type { CommentsStoreComment } from '../models'

import type { CommentsContext } from './comments.context'

function dedupeComments(items: CommentsStoreComment[]): CommentsStoreComment[] {
  const unique = new Map<string, CommentsStoreComment>()
  items.forEach(item => unique.set(item.id, item))
  return Array.from(unique.values())
}

function normalizeTargets(targets: CommentTargetKey[]): CommentTargetKey[] {
  return Array.from(new Set(targets))
}

export function createCommentsSyncUseCases(context: CommentsContext) {
  function filterHiddenSyncedComments(items: CommentsStoreComment[]): CommentsStoreComment[] {
    const hiddenIds = new Set(context.hiddenSyncedCommentIds.value)
    return items.filter(item => !hiddenIds.has(item.id))
  }

  async function resolveAuthors(items: CommentsStoreComment[]): Promise<CommentsStoreComment[]> {
    return await Promise.all(items.map(async item => ({
      ...item,
      author: await resolveCommentAuthor(item.author),
    })))
  }

  function replaceSyncedComments(syncedComments: CommentsStoreComment[]): void {
    context.comments.value = dedupeComments([
      ...context.comments.value.filter(comment => comment.status !== 'synced'),
      ...filterHiddenSyncedComments(syncedComments),
    ])
  }

  function initializeSubscriptions(): void {
    if (context.initialized.value) return
    context.initialized.value = true

    context.unsubscribeHandlers.push(
      context.client.onCommentAdded(() => {
        void refreshComments()
      }),
      context.client.onYourCommentAdded(() => {
        void refreshComments()
      }),
      context.client.onCommentUpdated(() => {
        void refreshComments()
      }),
      context.client.onCommentMoved(() => {
        void refreshComments()
      }),
      context.client.onCommentCompleted(() => {
        void refreshComments()
      }),
      context.client.onCommentDeleted(() => {
        void refreshComments()
      }),
    )
  }

  async function ensureConnected(): Promise<void> {
    if (context.connectionStatus.value === 'connected') {
      return
    }

    if (context.connectPromise.value) {
      await context.connectPromise.value
      return
    }

    initializeSubscriptions()
    context.connectionStatus.value = 'connecting'
    context.loadError.value = null

    context.connectPromise.value = (async () => {
      try {
        await context.client.start()
        context.connectionStatus.value = 'connected'
      } catch (error) {
        context.connectionStatus.value = 'error'
        context.loadError.value = error instanceof Error ? error.message : 'Не удалось подключиться к comments hub'
        throw error
      } finally {
        context.connectPromise.value = null
      }
    })()

    await context.connectPromise.value
  }

  async function refreshComments(): Promise<void> {
    if (context.activeSchemeId.value === null || context.activeVersionId.value === null) return

    await ensureConnected()

    const payload = await context.client.joinComments({
      schemeId: context.activeSchemeId.value,
      versionId: context.activeVersionId.value,
    })
    const mappedComments = mapJoinedCommentList(payload, context.subscribedTargets.value)
    replaceSyncedComments(await resolveAuthors(mappedComments))
  }

  async function initializeForScheme(schemeId: number, versionId: number, targets: CommentTargetKey[]): Promise<void> {
    if (!Number.isFinite(schemeId) || !Number.isFinite(versionId)) return

    context.isLoading.value = true
    context.loadError.value = null

    try {
      if (context.activeSchemeId.value !== null && context.activeSchemeId.value !== schemeId) {
        await reset()
      }

      context.activeSchemeId.value = schemeId
      context.activeVersionId.value = versionId
      context.subscribedTargets.value = normalizeTargets(targets)
      await ensureConnected()
      await refreshComments()
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось инициализировать комментарии'
    } finally {
      context.isLoading.value = false
    }
  }

  async function syncTargets(targets: CommentTargetKey[]): Promise<void> {
    if (context.activeSchemeId.value === null || context.activeVersionId.value === null) return

    try {
      context.subscribedTargets.value = normalizeTargets(targets)
      await refreshComments()
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось синхронизировать комментарии'
    }
  }

  async function syncVersion(versionId: number | null): Promise<void> {
    context.activeVersionId.value = versionId

    if (versionId === null) {
      context.comments.value = context.comments.value.filter(comment => comment.status !== 'synced')
      return
    }

    if (context.activeSchemeId.value === null) return

    try {
      await refreshComments()
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось синхронизировать версию комментариев'
    }
  }

  async function refreshTarget(_targetKey?: CommentTargetKey): Promise<void> {
    if (context.activeSchemeId.value === null || context.activeVersionId.value === null) return

    try {
      await refreshComments()
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось обновить комментарии'
    }
  }

  async function reset(): Promise<void> {
    if (context.activeSchemeId.value !== null) {
      try {
        await context.client.leaveComments(context.activeSchemeId.value)
      } catch {
        // noop
      }
    }

    try {
      await context.client.stop()
    } catch {
      // noop
    }

    while (context.unsubscribeHandlers.length) {
      context.unsubscribeHandlers.pop()?.()
    }

    context.comments.value = []
    context.isLoading.value = false
    context.loadError.value = null
    context.connectionStatus.value = 'idle'
    context.activeSchemeId.value = null
    context.activeVersionId.value = null
    context.subscribedTargets.value = []
    context.initialized.value = false
    context.connectPromise.value = null
  }

  return {
    initializeForScheme,
    syncTargets,
    syncVersion,
    refreshTarget,
    reset,
  }
}
