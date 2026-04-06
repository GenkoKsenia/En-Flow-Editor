import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'

import { buildCommentTargetKey, type CommentTargetKey, useCommentsStore } from '@/domains/comments'
import { useDiagramCollaborationStore, useDiagramStore } from '@/domains/diagram'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'

function parseSchemeId(rawSchemeId: string | null | undefined): number | null {
  if (!rawSchemeId) return null
  const value = Number(rawSchemeId)
  return Number.isFinite(value) ? value : null
}

export function useFlowEditorRoute() {
  const route = useRoute()
  const diagramStore = useDiagramStore()
  const commentsStore = useCommentsStore()
  const uiStore = useEditorUiStore()
  const collaborationStore = useDiagramCollaborationStore()

  const schemeId = computed(() => {
    const raw = route.params.schemeId
    return typeof raw === 'string' ? raw : null
  })
  const commentTargets = computed<CommentTargetKey[]>(() => [
    'canvas',
    ...diagramStore.nodes.map(node => buildCommentTargetKey('node', node.id)),
    ...diagramStore.edges.map(edge => buildCommentTargetKey('edge', edge.id)),
  ])
  let navigationRequestId = 0

  watch(
    schemeId,
    async (nextSchemeId, previousSchemeId) => {
      const requestId = ++navigationRequestId

      try {
        if (nextSchemeId !== previousSchemeId) {
          diagramStore.disconnectCollaboration()
          diagramStore.connectCollaboration(collaborationStore)
        }

        uiStore.resetForScheme()
        await diagramStore.loadCurrentVersion(nextSchemeId)
        if (requestId !== navigationRequestId) return

        const previousNumericId = parseSchemeId(previousSchemeId)
        const nextNumericId = parseSchemeId(nextSchemeId)

        if (previousNumericId !== null && previousNumericId !== nextNumericId) {
          await collaborationStore.leaveScheme(previousNumericId)
        }
        if (requestId !== navigationRequestId) return

        if (nextNumericId !== null) {
          await collaborationStore.joinScheme(nextNumericId)
          if (requestId !== navigationRequestId) return
          await commentsStore.initializeForScheme(nextNumericId, commentTargets.value)
        } else {
          await collaborationStore.disconnect()
          await commentsStore.reset()
        }
      } catch (error) {
        collaborationStore.lastError = error instanceof Error
          ? error.message
          : 'Не удалось инициализировать realtime-сессию схемы'
      }
    },
    { immediate: true },
  )

  watch(commentTargets, targets => {
    void commentsStore.syncTargets(targets)
  })

  onBeforeUnmount(() => {
    diagramStore.disconnectCollaboration()
    void collaborationStore.disconnect()
    void commentsStore.reset()
  })

  return {
    schemeId,
  }
}
