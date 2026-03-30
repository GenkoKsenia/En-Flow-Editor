import type { SchemeHubCodeRequest } from '@/domains/collaboration'

import type {
  EditorBlockDto,
  EditorConnectionDto,
  EditorDataFlowDto,
  EditorDocumentDto,
  EditorStylesDto,
} from '../api'

import type { EditorDocumentContext } from './editorDocument.context'

type DocumentLoadingDependencies = {
  resetDocument: () => void
  setDocumentFromServer: (code: unknown) => void
  serializeDocument: () => EditorDocumentDto
  applyParsedDiagram: (parsed: EditorDocumentDto) => void
  syncJsonFromState: () => void
}

export function createDocumentLoadingUseCases(
  context: EditorDocumentContext,
  dependencies: DocumentLoadingDependencies,
) {
  async function loadSchemeSnapshot(nextSchemeId?: string | null): Promise<void> {
    context.schemeId.value = nextSchemeId ?? null
    if (!nextSchemeId) {
      dependencies.resetDocument()
      return
    }

    context.isLoading.value = true
    context.loadError.value = null

    try {
      const scheme = await context.getSchemeById(nextSchemeId)
      const latestVersion = scheme.versions[0]
      context.currentVersionId.value = latestVersion?.id ?? null

      if (latestVersion) {
        dependencies.setDocumentFromServer(latestVersion.code)
      } else {
        dependencies.resetDocument()
      }
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось загрузить схему'
      dependencies.resetDocument()
    } finally {
      context.isLoading.value = false
    }
  }

  async function saveCurrentVersion(): Promise<void> {
    if (!context.currentVersionId.value) {
      await loadSchemeSnapshot(context.schemeId.value)
    }

    if (!context.currentVersionId.value) return

    const payload = typeof context.jsonBuffer.value === 'string'
      ? JSON.parse(context.jsonBuffer.value)
      : JSON.parse(JSON.stringify(context.jsonBuffer.value))

    await context.updateVersion(context.currentVersionId.value, payload)
  }

  function applyRemoteChanges(changes: SchemeHubCodeRequest): void {
    const current = dependencies.serializeDocument()
    const nextStyles = (changes.styles ?? {}) as EditorStylesDto
    const merged: EditorDocumentDto = {
      blocks: Array.isArray(changes.blocks) ? changes.blocks as EditorBlockDto[] : current.blocks,
      dataFlows: Array.isArray(changes.dataFlows) ? changes.dataFlows as EditorDataFlowDto[] : current.dataFlows,
      connections: Array.isArray(changes.connections) ? changes.connections as EditorConnectionDto[] : current.connections,
      comments: current.comments,
      styles: {
        ...(current.styles ?? {}),
        ...nextStyles,
      },
    }

    dependencies.applyParsedDiagram(merged)
    dependencies.syncJsonFromState()
  }

  return {
    loadSchemeSnapshot,
    saveCurrentVersion,
    applyRemoteChanges,
  }
}
