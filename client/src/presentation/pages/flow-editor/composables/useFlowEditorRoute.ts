import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'

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
  const uiStore = useEditorUiStore()
  const collaborationStore = useEditorCollaborationStore()

  const schemeId = computed(() => {
    const raw = route.params.schemeId
    return typeof raw === 'string' ? raw : null
  })

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
      } else {
        await collaborationStore.disconnect()
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    void collaborationStore.disconnect()
  })

  return {
    schemeId,
  }
}
