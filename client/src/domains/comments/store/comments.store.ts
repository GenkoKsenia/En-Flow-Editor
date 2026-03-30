import { ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { MOCK_CURRENT_USER_NAME } from '@/mocks'

import { createCommentsRealtimeClient } from '../api'
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

  const comments = ref<CommentsStoreComment[]>([])
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)
  const connectionStatus = ref<CommentsConnectionStatus>('idle')
  const activeSchemeId = ref<number | null>(null)
  const subscribedTargets = ref<CommentTargetKey[]>([])
  const draftCounter = ref(1)
  const initialized = ref(false)
  const connectPromise = shallowRef<Promise<void> | null>(null)
  const unsubscribeHandlers: Array<() => void> = []
  const context: CommentsContext = {
    client,
    comments,
    isLoading,
    loadError,
    connectionStatus,
    activeSchemeId,
    subscribedTargets,
    draftCounter,
    initialized,
    connectPromise,
    unsubscribeHandlers,
    getDefaultAuthor: () => MOCK_CURRENT_USER_NAME,
  }

  const syncUseCases = createCommentsSyncUseCases(context)
  const localUseCases = createCommentsLocalUseCases(context, {
    refreshTarget: syncUseCases.refreshTarget,
  })

  const { initializeForScheme, syncTargets, refreshTarget, reset } = syncUseCases
  const { startDraft, updateDraft, submitDraft, discardDraft } = localUseCases

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
