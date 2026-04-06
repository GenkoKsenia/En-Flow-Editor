import {
  buildCommentTargetKey,
  parseCommentTargetKey,
  type CommentTargetKey,
} from '../lib'
import {
  inferRefreshTargetKey,
  mapJoinedCommentList,
} from '../mappers'
import { resolveCommentAuthor } from '../api'
import type { CommentsStoreComment } from '../models'

import type { CommentsContext } from './comments.context'

function matchesTarget(comment: CommentsStoreComment, targetKey: CommentTargetKey): boolean {
  const { type, targetId } = parseCommentTargetKey(targetKey)
  return comment.targetType === type && comment.targetId === targetId
}

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

  function replaceSyncedCommentsForTarget(targetKey: CommentTargetKey, syncedComments: CommentsStoreComment[]): void {
    context.comments.value = dedupeComments([
      ...context.comments.value.filter(comment => !(comment.status === 'synced' && matchesTarget(comment, targetKey))),
      ...filterHiddenSyncedComments(syncedComments),
    ])
  }

  function initializeSubscriptions(): void {
    if (context.initialized.value) return
    context.initialized.value = true

    context.unsubscribeHandlers.push(
      context.client.onCommentAdded(payload => {
        const targetKey = inferRefreshTargetKey(payload, context.subscribedTargets.value)
        if (targetKey) {
          void refreshTarget(targetKey)
        }
      }),
      context.client.onYourCommentAdded(payload => {
        const targetKey = inferRefreshTargetKey(payload, context.subscribedTargets.value)
        if (targetKey) {
          void refreshTarget(targetKey)
        }
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

  async function joinTarget(targetKey: CommentTargetKey): Promise<void> {
    if (context.activeSchemeId.value === null) return

    await ensureConnected()

    const { type, targetId } = parseCommentTargetKey(targetKey)
    const payload = await context.client.joinElementComments(
      context.activeSchemeId.value,
      type === 'canvas' ? '' : (targetId ?? ''),
    )
    const mappedComments = mapJoinedCommentList(payload, targetKey)
    replaceSyncedCommentsForTarget(targetKey, await resolveAuthors(mappedComments))
  }

  async function leaveTarget(targetKey: CommentTargetKey): Promise<void> {
    if (context.activeSchemeId.value === null) return

    const { type, targetId } = parseCommentTargetKey(targetKey)
    await context.client.leaveElementComments(
      context.activeSchemeId.value,
      type === 'canvas' ? '' : (targetId ?? ''),
    )
  }

  async function bootstrapTargets(targets: CommentTargetKey[]): Promise<void> {
    const nextTargets = normalizeTargets(targets)
    const nextTargetsSet = new Set(nextTargets)

    for (const targetKey of context.subscribedTargets.value) {
      if (nextTargetsSet.has(targetKey)) continue

      await leaveTarget(targetKey)
      context.comments.value = context.comments.value.filter(comment => !matchesTarget(comment, targetKey))
    }

    for (const targetKey of nextTargets) {
      await joinTarget(targetKey)
    }

    context.subscribedTargets.value = nextTargets
  }

  async function initializeForScheme(schemeId: number, targets: CommentTargetKey[]): Promise<void> {
    if (!Number.isFinite(schemeId)) return

    context.isLoading.value = true
    context.loadError.value = null

    try {
      if (context.activeSchemeId.value !== null && context.activeSchemeId.value !== schemeId) {
        await reset()
      }

      context.activeSchemeId.value = schemeId
      await ensureConnected()
      await bootstrapTargets(targets)
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось инициализировать комментарии'
    } finally {
      context.isLoading.value = false
    }
  }

  async function syncTargets(targets: CommentTargetKey[]): Promise<void> {
    if (context.activeSchemeId.value === null) return

    try {
      await ensureConnected()

      const nextTargets = normalizeTargets(targets)
      const previousTargets = new Set(context.subscribedTargets.value)
      const nextTargetsSet = new Set(nextTargets)

      for (const targetKey of context.subscribedTargets.value) {
        if (nextTargetsSet.has(targetKey)) continue

        await leaveTarget(targetKey)
        context.comments.value = context.comments.value.filter(comment => !matchesTarget(comment, targetKey))
      }

      for (const targetKey of nextTargets) {
        if (previousTargets.has(targetKey)) continue
        await joinTarget(targetKey)
      }

      context.subscribedTargets.value = nextTargets
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось синхронизировать комментарии'
    }
  }

  async function refreshTarget(targetKey: CommentTargetKey): Promise<void> {
    if (!context.subscribedTargets.value.includes(targetKey)) return

    try {
      await joinTarget(targetKey)
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось обновить комментарии'
    }
  }

  async function reset(): Promise<void> {
    if (context.activeSchemeId.value !== null) {
      for (const targetKey of context.subscribedTargets.value) {
        try {
          await leaveTarget(targetKey)
        } catch {
          // noop
        }
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
    context.subscribedTargets.value = []
    context.initialized.value = false
    context.connectPromise.value = null
  }

  return {
    initializeForScheme,
    syncTargets,
    refreshTarget,
    reset,
  }
}
