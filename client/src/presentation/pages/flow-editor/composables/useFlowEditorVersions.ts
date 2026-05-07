import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import type { SchemeVersion } from '@/domains/schemes'
import { getLatestVersionChanges, getVersionsByScheme, type CodeDifferenceDto } from '@/domains/diagram'
import { useDiagramStore } from '@/domains/diagram'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'

function toTimestamp(value: string): number {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

function normalizeDateTimeLocal(value: string): string {
  return value.trim()
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toDateTimeLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function createDefaultVersionRange(): { from: string; to: string } {
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000

  return {
    from: toDateTimeLocalValue(new Date(now.getTime() - dayMs)),
    to: toDateTimeLocalValue(new Date(now.getTime() + dayMs)),
  }
}

function isVersionWithinRange(version: SchemeVersion, from: string, to: string): boolean {
  const timestamp = toTimestamp(version.date)
  if (!timestamp) return false

  const fromTimestamp = toTimestamp(from)
  const toTimestampValue = toTimestamp(to)

  if (fromTimestamp && timestamp < fromTimestamp) return false
  if (toTimestampValue && timestamp > toTimestampValue) return false
  return true
}

export function useFlowEditorVersions() {
  const diagramStore = useDiagramStore()
  const uiStore = useEditorUiStore()

  const { schemeId } = storeToRefs(diagramStore)

  const initialRange = createDefaultVersionRange()
  const versionFilterFrom = ref(initialRange.from)
  const versionFilterTo = ref(initialRange.to)
  const fetchedVersions = ref<SchemeVersion[]>([])
  const hasRequestedVersions = ref(false)
  const isLoadingVersions = ref(false)
  const versionsError = ref<string | null>(null)

  const isComparisonDialogOpen = ref(false)
  const selectedVersionId = ref<string | null>(null)
  const comparisonChanges = ref<CodeDifferenceDto[]>([])
  const isLoadingComparison = ref(false)
  const comparisonError = ref<string | null>(null)

  const isVersionsDialogOpen = computed(() => uiStore.isVersionMenuOpen)
  const hasVersionRange = computed(() => Boolean(versionFilterFrom.value && versionFilterTo.value))
  const selectedVersion = computed(() =>
    fetchedVersions.value.find(version => version.id === selectedVersionId.value) ?? null,
  )
  const latestVersion = computed(() => fetchedVersions.value[0] ?? null)
  const filteredVersions = computed(() => {
    if (!hasRequestedVersions.value) return []

    const from = normalizeDateTimeLocal(versionFilterFrom.value)
    const to = normalizeDateTimeLocal(versionFilterTo.value)
    const latestVersionId = latestVersion.value?.id

    return fetchedVersions.value.filter(version =>
      version.id !== latestVersionId
      && isVersionWithinRange(version, from, to),
    )
  })

  function resetBrowserState(): void {
    const nextRange = createDefaultVersionRange()
    versionFilterFrom.value = nextRange.from
    versionFilterTo.value = nextRange.to
    fetchedVersions.value = []
    hasRequestedVersions.value = false
    isLoadingVersions.value = false
    versionsError.value = null
    selectedVersionId.value = null
    comparisonChanges.value = []
    isLoadingComparison.value = false
    comparisonError.value = null
    isComparisonDialogOpen.value = false
  }

  async function requestVersions(): Promise<void> {
    const currentSchemeId = schemeId.value
    if (!currentSchemeId) {
      versionsError.value = 'Не удалось определить схему'
      return
    }

    const from = normalizeDateTimeLocal(versionFilterFrom.value)
    const to = normalizeDateTimeLocal(versionFilterTo.value)

    if (!from || !to) {
      versionsError.value = 'Укажи период, за который нужно показать версии'
      return
    }

    const fromTimestamp = toTimestamp(from)
    const toTimestampValue = toTimestamp(to)
    if (!fromTimestamp || !toTimestampValue) {
      versionsError.value = 'Неверный формат даты периода'
      return
    }

    if (fromTimestamp > toTimestampValue) {
      versionsError.value = 'Дата начала периода должна быть раньше даты окончания'
      return
    }

    isLoadingVersions.value = true
    versionsError.value = null
    hasRequestedVersions.value = true

    try {
      const versions = await getVersionsByScheme(currentSchemeId)
      fetchedVersions.value = [...versions].sort((left, right) => toTimestamp(right.date) - toTimestamp(left.date))
    } catch (error) {
      versionsError.value = error instanceof Error ? error.message : 'Не удалось загрузить версии'
    } finally {
      isLoadingVersions.value = false
    }
  }

  async function openComparison(versionId: string): Promise<void> {
    const currentSchemeId = schemeId.value
    if (!currentSchemeId) return

    const version = fetchedVersions.value.find(item => item.id === versionId)
    if (!version) return

    selectedVersionId.value = versionId
    isComparisonDialogOpen.value = true
    isLoadingComparison.value = true
    comparisonError.value = null
    comparisonChanges.value = []

    try {
      comparisonChanges.value = await getLatestVersionChanges(currentSchemeId)
    } catch (error) {
      comparisonError.value = error instanceof Error ? error.message : 'Не удалось загрузить изменения между версиями'
    } finally {
      isLoadingComparison.value = false
    }
  }

  function closeVersionsDialog(): void {
    uiStore.closeVersionMenu()
  }

  function openVersionsDialog(): void {
    uiStore.toggleVersionMenu()
  }

  function closeComparison(): void {
    isComparisonDialogOpen.value = false
    selectedVersionId.value = null
    comparisonChanges.value = []
    comparisonError.value = null
  }

  watch(isVersionsDialogOpen, isOpen => {
    if (isOpen) {
      resetBrowserState()
      return
    }

    closeComparison()
  })

  return {
    isVersionsDialogOpen,
    versionFilterFrom,
    versionFilterTo,
    hasVersionRange,
    hasRequestedVersions,
    isLoadingVersions,
    versionsError,
    filteredVersions,
    latestVersion,
    selectedVersion,
    isComparisonDialogOpen,
    comparisonChanges,
    isLoadingComparison,
    comparisonError,
    openVersionsDialog,
    closeVersionsDialog,
    requestVersions,
    openComparison,
    closeComparison,
  }
}
