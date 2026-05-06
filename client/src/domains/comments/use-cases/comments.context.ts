import type { Ref, ShallowRef } from 'vue'

import type { CommentsHubClient } from '../api'
import type { CommentTargetKey } from '../lib'
import type { CommentsStoreComment } from '../models'

export type CommentsConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'
export type DraftPatch = Partial<Pick<CommentsStoreComment, 'text' | 'position'>>

export type CommentsContext = {
  client: CommentsHubClient
  comments: Ref<CommentsStoreComment[]>
  hiddenSyncedCommentIds: Ref<string[]>
  currentAuthorId: Ref<string | null>
  currentAuthorAliases: Ref<string[]>
  isLoading: Ref<boolean>
  loadError: Ref<string | null>
  connectionStatus: Ref<CommentsConnectionStatus>
  activeSchemeId: Ref<number | null>
  activeVersionId: Ref<number | null>
  subscribedTargets: Ref<CommentTargetKey[]>
  draftCounter: Ref<number>
  initialized: Ref<boolean>
  connectPromise: ShallowRef<Promise<void> | null>
  unsubscribeHandlers: Array<() => void>
  getDefaultAuthor: () => string
}
