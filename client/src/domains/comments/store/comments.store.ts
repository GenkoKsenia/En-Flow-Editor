import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { createCommentsRealtimeClient, getCurrentCommentAuthor, getCurrentCommentAuthorAliases, getCurrentCommentAuthorSid } from '../api'
import type { CommentTargetKey } from '../lib'
import type { CommentsStoreComment } from '../models'
import {
  createCommentsLocalUseCases,
  createCommentsSyncUseCases,
  type CommentsConnectionStatus,
  type CommentsContext,
} from '../use-cases'

export const useCommentsStore = defineStore('comments', () => {
  const client = createCommentsRealtimeClient()
  const currentAuthor = ref('Пользователь')
  const currentAuthorId = ref<string | null>(null)
  const currentAuthorAliases = ref<string[]>([])

  const comments = ref<CommentsStoreComment[]>([])
  const hiddenSyncedCommentIds = ref<string[]>([])
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  const connectionStatus = ref<CommentsConnectionStatus>('idle')
  const activeSchemeId = ref<number | null>(null)
  const activeVersionId = ref<number | null>(null)
  const subscribedTargets = ref<CommentTargetKey[]>([])
  const draftCounter = ref(1)
  const initialized = ref(false)
  const connectPromise = shallowRef<Promise<void> | null>(null)
  const unsubscribeHandlers: Array<() => void> = []
  const context: CommentsContext = {
    client,
    comments,
    hiddenSyncedCommentIds,
    currentAuthorId,
    currentAuthorAliases,
    isLoading,
    loadError,
    connectionStatus,
    activeSchemeId,
    activeVersionId,
    subscribedTargets,
    draftCounter,
    initialized,
    connectPromise,
    unsubscribeHandlers,
    getDefaultAuthor: () => currentAuthor.value,
  }

  void getCurrentCommentAuthor()
    .then(author => {
      if (author) {
        currentAuthor.value = author
      }
    })
    .catch(() => {})

  void getCurrentCommentAuthorSid()
    .then(authorId => {
      currentAuthorId.value = authorId
    })
    .catch(() => {
      currentAuthorId.value = null
    })

  void getCurrentCommentAuthorAliases()
    .then(aliases => {
      currentAuthorAliases.value = aliases
    })
    .catch(() => {
      currentAuthorAliases.value = []
    })

  const syncUseCases = createCommentsSyncUseCases(context)
  const localUseCases = createCommentsLocalUseCases(context, {
    refreshComments: () => syncUseCases.refreshTarget(),
  })

  const { initializeForScheme, syncTargets, syncVersion, refreshTarget, reset } = syncUseCases
  const {
    startDraft,
    updateDraft,
    submitDraft,
    saveSyncedComment,
    completeComment,
    deleteComment,
    discardDraft,
    dismissComment,
  } = localUseCases

  return {
    comments,
    currentAuthor,
    currentAuthorId,
    currentAuthorAliases,
    isLoading,
    loadError,
    connectionStatus,
    activeSchemeId,
    activeVersionId,
    subscribedTargets,
    initializeForScheme,
    syncTargets,
    syncVersion,
    startDraft,
    updateDraft,
    submitDraft,
    saveSyncedComment,
    completeComment,
    deleteComment,
    discardDraft,
    dismissComment,
    refreshTarget,
    reset,
  }
})
