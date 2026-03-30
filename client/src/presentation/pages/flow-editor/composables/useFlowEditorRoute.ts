import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'

import { buildCommentTargetKey, type CommentTargetKey, useCommentsStore } from '@/domains/comments'
import { useEditorDocumentStore } from '@/domains/editor-document'
import { useEditorCollaborationStore } from '@/domains/collaboration'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'

function parseSchemeId(rawSchemeId: string | null | undefined): number | null {
  if (!rawSchemeId) return null
  const value = Number(rawSchemeId)
  return Number.isFinite(value) ? value : null
}

export function useFlowEditorRoute() {
  const route = useRoute()
  const documentStore = useEditorDocumentStore()
  const commentsStore = useCommentsStore()
  const uiStore = useEditorUiStore()
  const collaborationStore = useEditorCollaborationStore()

  const schemeId = computed(() => {
    const raw = route.params.schemeId
    return typeof raw === 'string' ? raw : null
  })
  const commentTargets = computed<CommentTargetKey[]>(() => [
    'canvas',
    ...documentStore.nodes.map(node => buildCommentTargetKey('node', node.id)),
    ...documentStore.edges.map(edge => buildCommentTargetKey('edge', edge.id)),
  ])

  watch(
    schemeId,
    async (nextSchemeId, previousSchemeId) => {
      uiStore.resetForScheme()
      await documentStore.loadSchemeSnapshot(nextSchemeId)

      const previousNumericId = parseSchemeId(previousSchemeId)
      const nextNumericId = parseSchemeId(nextSchemeId)

      if (previousNumericId !== null && previousNumericId !== nextNumericId) {
        await collaborationStore.leaveScheme(previousNumericId)
      }

      if (nextNumericId !== null) {
        await collaborationStore.joinScheme(nextNumericId)
        await commentsStore.initializeForScheme(nextNumericId, commentTargets.value)
      } else {
        await collaborationStore.disconnect()
        await commentsStore.reset()
      }
    },
    { immediate: true },
  )

  watch(commentTargets, targets => {
    void commentsStore.syncTargets(targets)
  })

  onBeforeUnmount(() => {
    void collaborationStore.disconnect()
    void commentsStore.reset()
  })

  return {
    schemeId,
  }
}
