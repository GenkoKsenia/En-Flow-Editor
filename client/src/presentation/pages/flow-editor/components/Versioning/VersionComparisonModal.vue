<template>
  <BaseModal :open="true" title="Сравнение версий" width="1480px" @close="$emit('close')">
    <div class="comparison-layout">
      <aside class="comparison-sidebar">
        <div class="comparison-sidebar__header">
          <h3>Изменения в коде</h3>
        </div>

        <div v-if="loading" class="comparison-sidebar__state">Загрузка изменений...</div>
        <div v-else-if="error" class="comparison-sidebar__state comparison-sidebar__state--error">{{ error }}</div>
        <div v-else-if="displayedChanges.length" class="comparison-sidebar__content">
          <div class="comparison-diff-list">
            <div
              v-for="(change, index) in displayedChanges"
              :key="`${change.propertyName}-${index}`"
              class="comparison-diff-row"
            >
              <div class="comparison-diff-row__path">{{ formatPropertyName(change.propertyName) }}</div>
              <div class="comparison-diff-row__preview">
                <span class="comparison-diff-row__preview-label comparison-diff-row__preview-label--before">Было</span>
                <span class="comparison-diff-row__preview-value">{{ formatBeforeValue(change) }}</span>
              </div>
              <div class="comparison-diff-row__preview">
                <span class="comparison-diff-row__preview-label comparison-diff-row__preview-label--after">Стало</span>
                <span class="comparison-diff-row__preview-value">{{ formatAfterValue(change) }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="comparison-sidebar__state">Изменения не найдены.</div>
      </aside>

      <section class="comparison-column">
        <header class="comparison-column__header">
          <div>
            <h3>{{ formatVersionDate(selectedVersion.date) }}</h3>
            <p>Выбранная версия</p>
          </div>
        </header>

        <div class="comparison-column__preview">
          <VersionSnapshotImage :code="selectedVersion.code" />
        </div>
      </section>

      <section class="comparison-column">
        <header class="comparison-column__header">
          <div>
            <h3>Текущее состояние</h3>
            <p>То, что сейчас на экране</p>
          </div>
        </header>

        <div class="comparison-column__preview">
          <VersionSnapshotImage :code="currentCode" />
        </div>
      </section>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { SchemeVersion } from '@/domains/schemes'
import type { CodeDifferenceDto } from '@/domains/diagram'
import VersionSnapshotImage from './VersionSnapshotImage.vue'
import BaseModal from '@/presentation/ui/BaseModal.vue'
import { parseVersionSnapshotGraph } from './versionSnapshotGraph'

const props = defineProps<{
  selectedVersion: SchemeVersion
  currentCode: unknown
  changes: CodeDifferenceDto[]
  loading: boolean
  error: string | null
}>()

defineEmits<{
  close: []
}>()

type VersionDiffMaps = {
  blockLabels: Map<string, string>
  edgeLabels: Map<string, string>
  dataFlowLabels: Map<string, string>
}

type DisplayedChange = CodeDifferenceDto

type VersionCodeCounts = {
  blocks: number
  dataFlows: number
  connections: number
  blockStyles: number
  connectionStyles: number
}

type ParsedVersionCode = Record<string, unknown> | null

const versionDiffMaps = computed<VersionDiffMaps>(() => {
  const blockLabels = new Map<string, string>()
  const edgeLabels = new Map<string, string>()
  const dataFlowLabels = new Map<string, string>()

  const collectFromCode = (code: unknown) => {
    const graph = parseVersionSnapshotGraph(code)
    graph.nodes.forEach(node => {
      const label = node.text.trim() || node.id
      blockLabels.set(node.id, label)
    })
    graph.edges.forEach(edge => {
      const label = edge.label?.trim() || edge.id
      edgeLabels.set(edge.id, label)
    })

    let parsed: Record<string, unknown> | null = null
    if (typeof code === 'string') {
      try {
        parsed = JSON.parse(code) as Record<string, unknown>
      } catch {
        parsed = null
      }
    } else if (code && typeof code === 'object') {
      parsed = code as Record<string, unknown>
    }

    const rawDataFlows = parsed?.dataFlows
    if (Array.isArray(rawDataFlows)) {
      rawDataFlows.forEach(item => {
        if (!item || typeof item !== 'object') return
        const dataKey = typeof (item as { dataKey?: unknown }).dataKey === 'string'
          ? (item as { dataKey: string }).dataKey
          : null
        const dataName = typeof (item as { dataName?: unknown }).dataName === 'string'
          ? (item as { dataName: string }).dataName
          : null
        if (dataKey) {
          dataFlowLabels.set(dataKey, dataName?.trim() || dataKey)
        }
      })
    }
  }

  collectFromCode(props.selectedVersion.code)
  collectFromCode(props.currentCode)

  return {
    blockLabels,
    edgeLabels,
    dataFlowLabels,
  }
})

const selectedVersionCode = computed<ParsedVersionCode>(() => parseVersionCode(props.selectedVersion.code))
const currentVersionCode = computed<ParsedVersionCode>(() => parseVersionCode(props.currentCode))

const displayedChanges = computed<DisplayedChange[]>(() => {
  const summaryRows = buildCollectionSummaryRows(selectedVersionCode.value, currentVersionCode.value)
  const summaryKeys = new Set(summaryRows.map(change => change.propertyName))

  const filteredRows = props.changes.filter(change => {
    if (summaryKeys.has(change.propertyName)) {
      return false
    }

    return !isObjectLevelCollectionChange(change.propertyName)
  })

  return [...summaryRows, ...filteredRows]
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatVersionDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function normalizeDiffValue(value: string | null): string {
  if (value === null || value === undefined || value === '') {
    return '—'
  }

  const trimmed = String(value).trim()
  if (trimmed === '(null)') {
    return '—'
  }

  const typeLabels: Record<string, string> = {
    'Diplom.Models.Requests.Block': 'Блок',
    'Diplom.Models.Requests.DataFlow': 'Поток данных',
    'Diplom.Models.Requests.Connection': 'Связь',
    'Diplom.Models.Requests.BlockStyle': 'Стиль блока',
    'Diplom.Models.Requests.ConnectionStyle': 'Стиль связи',
  }

  return typeLabels[trimmed] ?? trimmed
}

function parseVersionCode(code: unknown): ParsedVersionCode {
  if (typeof code === 'string') {
    try {
      return JSON.parse(code) as Record<string, unknown>
    } catch {
      return null
    }
  }

  if (code && typeof code === 'object') {
    return code as Record<string, unknown>
  }

  return null
}

function getArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function getVersionCodeCounts(code: ParsedVersionCode): VersionCodeCounts {
  const styles = code?.styles && typeof code.styles === 'object'
    ? code.styles as Record<string, unknown>
    : null

  return {
    blocks: getArrayLength(code?.blocks),
    dataFlows: getArrayLength(code?.dataFlows),
    connections: getArrayLength(code?.connections),
    blockStyles: getArrayLength(styles?.blocks),
    connectionStyles: getArrayLength(styles?.connections),
  }
}

function createSummaryChange(propertyName: string, before: number, after: number): DisplayedChange {
  return {
    propertyName,
    firstObjectValue: String(before),
    secondObjectValue: String(after),
  }
}

function buildCollectionSummaryRows(
  selectedCode: ParsedVersionCode,
  currentCode: ParsedVersionCode,
): DisplayedChange[] {
  if (!selectedCode || !currentCode) {
    return []
  }

  const before = getVersionCodeCounts(selectedCode)
  const after = getVersionCodeCounts(currentCode)
  const rows: DisplayedChange[] = []

  if (before.blocks !== after.blocks) {
    rows.push(createSummaryChange('Blocks', before.blocks, after.blocks))
  }

  if (before.dataFlows !== after.dataFlows) {
    rows.push(createSummaryChange('DataFlows', before.dataFlows, after.dataFlows))
  }

  if (before.connections !== after.connections) {
    rows.push(createSummaryChange('Connections', before.connections, after.connections))
  }

  if (before.blockStyles !== after.blockStyles) {
    rows.push(createSummaryChange('Styles.Blocks', before.blockStyles, after.blockStyles))
  }

  if (before.connectionStyles !== after.connectionStyles) {
    rows.push(createSummaryChange('Styles.Connections', before.connectionStyles, after.connectionStyles))
  }

  return rows
}

function isObjectLevelCollectionChange(propertyName: string): boolean {
  return [
    /^Blocks\[Id:[^\]]+\]$/,
    /^Connections\[Id:[^\]]+\]$/,
    /^DataFlows\[DataKey:[^\]]+\]$/,
    /^Styles\.Blocks\[ElementId:[^\]]+\]$/,
    /^Styles\.Connections\[ElementId:[^\]]+\]$/,
  ].some(pattern => pattern.test(propertyName))
}

function formatCompactValue(value: string | null): string {
  const normalized = normalizeDiffValue(value).replace(/\s+/g, ' ').trim()
  if (normalized.length <= 46) return normalized
  return `${normalized.slice(0, 46)}...`
}

function formatPropertyName(propertyName: string): string {
  const { blockLabels, edgeLabels, dataFlowLabels } = versionDiffMaps.value

  const topLevelLabels: Record<string, string> = {
    Blocks: 'Количество блоков',
    DataFlows: 'Количество потоков данных',
    Connections: 'Количество связей',
    'Styles.Blocks': 'Количество стилей блоков',
    'Styles.Connections': 'Количество стилей связей',
  }

  if (topLevelLabels[propertyName]) {
    return topLevelLabels[propertyName]
  }

  return propertyName
    .replace(/Blocks\[Id:([^\]]+)\]/g, (_, id: string) => `Blocks[${blockLabels.get(id) ?? id}]`)
    .replace(/Connections\[Id:([^\]]+)\]/g, (_, id: string) => `Connections[${edgeLabels.get(id) ?? id}]`)
    .replace(/DataFlows\[DataKey:([^\]]+)\]/g, (_, dataKey: string) => `DataFlows[${dataFlowLabels.get(dataKey) ?? dataKey}]`)
    .replace(/Styles\.Blocks\[ElementId:([^\]]+)\]/g, (_, id: string) => `Styles.Blocks[${blockLabels.get(id) ?? id}]`)
    .replace(/Styles\.Connections\[ElementId:([^\]]+)\]/g, (_, id: string) => `Styles.Connections[${edgeLabels.get(id) ?? id}]`)
}

function formatBeforeValue(change: CodeDifferenceDto): string {
  return formatCompactValue(change.firstObjectValue)
}

function formatAfterValue(change: CodeDifferenceDto): string {
  return formatCompactValue(change.secondObjectValue)
}
</script>

<style scoped>
.comparison-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  height: min(78vh, 820px);
  min-height: 720px;
}

.comparison-sidebar,
.comparison-column {
  min-height: 0;
  height: 100%;
  border: 1px solid #d8dee7;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.comparison-sidebar {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}

.comparison-sidebar__header,
.comparison-column__header {
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
}

.comparison-sidebar__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comparison-sidebar__header h3,
.comparison-column__header h3 {
  margin: 0;
  font-size: 18px;
  color: #111827;
}

.comparison-sidebar__header p,
.comparison-column__header p {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
}

.comparison-sidebar__state {
  padding: 16px;
  color: #6b7280;
  font-size: 14px;
}

.comparison-sidebar__state--error {
  color: #b42318;
}

.comparison-sidebar__content {
  min-height: 0;
}

.comparison-diff-list {
  height: 100%;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comparison-diff-row {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.comparison-diff-row__path {
  font-size: 12px;
  font-weight: 700;
  color: #334155;
  word-break: break-word;
}

.comparison-diff-row__preview {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.comparison-diff-row__preview-label {
  flex: 0 0 38px;
  font-size: 11px;
  font-weight: 700;
}

.comparison-diff-row__preview-label--before {
  color: #d9485f;
}

.comparison-diff-row__preview-label--after {
  color: #1f9d55;
}

.comparison-diff-row__preview-value {
  min-width: 0;
  color: #475569;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.comparison-column__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.comparison-column__preview {
  height: calc(100% - 69px);
  min-height: 0;
}

@media (max-width: 1200px) {
  .comparison-layout {
    grid-template-columns: 1fr;
    height: auto;
    min-height: auto;
  }

  .comparison-sidebar__content {
    min-height: 320px;
  }

  .comparison-column {
    min-height: 520px;
  }
}
</style>
