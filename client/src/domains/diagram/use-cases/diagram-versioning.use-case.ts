import type { DiagramDto } from '../api'

import type { DiagramContext } from './diagram.context'

type DiagramVersioningDependencies = {
  resetDiagram: () => void
  setDiagramFromServer: (code: unknown) => void
  serializeDiagram: () => DiagramDto
}

export function createDiagramVersioningUseCases(
  context: DiagramContext,
  dependencies: DiagramVersioningDependencies,
) {
  async function loadCurrentVersion(nextSchemeId?: string | null): Promise<void> {
    context.schemeId.value = nextSchemeId ?? null
    if (!nextSchemeId) {
      dependencies.resetDiagram()
      return
    }

    context.isLoading.value = true
    context.loadError.value = null

    try {
      const scheme = await context.getSchemeById(nextSchemeId)
      const latestVersion = scheme.versions[0]
      context.currentVersionId.value = latestVersion?.id ?? null

      if (latestVersion) {
        dependencies.setDiagramFromServer(latestVersion.code)
        context.lastPersistedJson.value = context.lastSerializedJson.value
      } else {
        dependencies.resetDiagram()
        context.lastPersistedJson.value = context.lastSerializedJson.value
      }
    } catch (error) {
      context.loadError.value = error instanceof Error ? error.message : 'Не удалось загрузить схему'
      dependencies.resetDiagram()
      context.lastPersistedJson.value = context.lastSerializedJson.value
    } finally {
      context.isLoading.value = false
    }
  }

  async function saveCurrentVersion(): Promise<void> {
    if (!context.currentVersionId.value) {
      await loadCurrentVersion(context.schemeId.value)
    }

    if (!context.currentVersionId.value) return

    const payload = dependencies.serializeDiagram()

    await context.updateVersion(context.currentVersionId.value, payload)
    context.lastPersistedJson.value = context.lastSerializedJson.value
  }

  return {
    loadCurrentVersion,
    saveCurrentVersion,
  }
}
