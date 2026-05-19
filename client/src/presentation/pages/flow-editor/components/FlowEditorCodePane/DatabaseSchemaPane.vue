<template>
  <div class="db-pane">
    <form class="db-form" autocomplete="off" @submit.prevent="loadTables">
      <div class="db-form__row">
        <label for="db-server">Сервер</label>
        <UiInput id="db-server" v-model="connection.server" block placeholder="DESKTOP\\SQLEXPRESS" />
      </div>

      <div class="db-form__row">
        <label for="db-database">База данных</label>
        <UiInput id="db-database" v-model="connection.database" block placeholder="redactor" />
      </div>

      <div class="db-form__row">
        <label for="db-auth">Аутентификация</label>
        <UiSelect id="db-auth" v-model="connection.authenticationType" class="db-form__select">
          <option value="windows">Windows</option>
          <option value="sql">SQL</option>
        </UiSelect>
      </div>

      <template v-if="connection.authenticationType === 'sql'">
        <div class="db-form__row">
          <label for="db-username">Логин</label>
          <UiInput
            id="db-username"
            v-model="connection.username"
            block
            name="db-username"
            autocomplete="off"
            placeholder="sa"
          />
        </div>

        <div class="db-form__row">
          <label for="db-password">Пароль</label>
          <UiInput
            id="db-password"
            v-model="connection.password"
            block
            type="password"
            name="db-password"
            autocomplete="new-password"
          />
        </div>
      </template>

      <UiButton type="submit" variant="primary" block :disabled="isConnectDisabled">
        {{ isLoading ? 'Загрузка...' : 'Подключиться' }}
      </UiButton>
    </form>

    <div v-if="errorMessage" class="db-state db-state--error">
      {{ errorMessage }}
    </div>

    <div v-else-if="successMessage" class="db-state db-state--success">
      {{ successMessage }}
    </div>

    <div class="db-list">
      <div class="db-list__header">
        <h3>Таблицы</h3>
        <UiInput
          v-model="search"
          class="db-list__search"
          placeholder="Поиск таблицы"
          :disabled="!tables.length"
        />
      </div>

      <div v-if="!tables.length" class="db-list__empty">
        Подключись к БД, чтобы увидеть список таблиц.
      </div>

      <div v-else class="db-list__items">
        <button
          v-for="table in filteredTables"
          :key="table.tableName"
          type="button"
          class="db-table-item"
          :class="{ 'db-table-item--added': isTableAdded(table.tableName) }"
          :disabled="props.readOnly"
          @click="addTableToDiagram(table)"
        >
          <span class="db-table-item__name">{{ table.tableName }}</span>
          <span class="db-table-item__meta">{{ table.columns.length }} столбцов</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

import { fetchDbInfo, type DbConnectionRequest, type DbTableInfo } from '@/domains/db-info'
import { useDiagramStore } from '@/domains/diagram'
import type { Edge, Node, Position } from '@/domains/graph'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'
import UiButton from '@/presentation/ui/UiButton.vue'
import UiInput from '@/presentation/ui/UiInput.vue'
import UiSelect from '@/presentation/ui/UiSelect.vue'

const props = defineProps<{
  readOnly?: boolean
}>()

const TABLE_WIDTH = 240
const TABLE_PADDING = 16
const TABLE_HEADER_HEIGHT = 34
const TABLE_GRID_COLUMNS = 3
const TABLE_X_GAP = 320
const TABLE_Y_GAP = 320
const TABLE_START_X = 80
const TABLE_START_Y = 80
const COLUMN_HEIGHT = 42
const COLUMN_GAP = 10
const COLUMN_WIDTH = TABLE_WIDTH - TABLE_PADDING * 2

const diagramStore = useDiagramStore()
const editorUiStore = useEditorUiStore()

const connection = reactive<DbConnectionRequest>({
  server: '',
  database: '',
  username: '',
  password: '',
  authenticationType: 'windows',
})

const tables = ref<DbTableInfo[]>([])
const search = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const filteredTables = computed(() => {
  const needle = search.value.trim().toLowerCase()
  if (!needle) return tables.value
  return tables.value.filter(table => table.tableName.toLowerCase().includes(needle))
})

const existingTableNodes = computed(() =>
  diagramStore.nodes.filter(node => isDbTableContainer(node, diagramStore.nodes)),
)

const isConnectDisabled = computed(() => (
  isLoading.value
  || !connection.server.trim()
  || !connection.database.trim()
  || (
    connection.authenticationType === 'sql'
    && (!connection.username.trim() || !connection.password)
  )
))

function isBoundaryNode(node: Node): boolean {
  return node.text.startsWith('Область ')
}

function getDirectChildren(nodeId: string): Node[] {
  return diagramStore.nodes.filter(node => node.parentId === nodeId)
}

function isLeafNode(node: Node, allNodes: Node[]): boolean {
  return !allNodes.some(item => item.parentId === node.id)
}

function isDbTableContainer(node: Node, allNodes: Node[]): boolean {
  if (isBoundaryNode(node)) return false
  const children = allNodes.filter(item => item.parentId === node.id)
  return children.length > 0 && children.every(child => isLeafNode(child, allNodes))
}

function isTableAdded(tableName: string): boolean {
  return existingTableNodes.value.some(node => node.text === tableName)
}

function findTableNode(tableName: string): Node | undefined {
  return existingTableNodes.value.find(node => node.text === tableName)
}

function findColumnNode(tableName: string, columnName: string): Node | undefined {
  const tableNode = findTableNode(tableName)
  if (!tableNode) return undefined
  return getDirectChildren(tableNode.id).find(child => child.text === columnName)
}

function getNextTablePosition(): Position {
  const index = existingTableNodes.value.length
  const column = index % TABLE_GRID_COLUMNS
  const row = Math.floor(index / TABLE_GRID_COLUMNS)

  return {
    x: TABLE_START_X + column * TABLE_X_GAP,
    y: TABLE_START_Y + row * TABLE_Y_GAP,
  }
}

function createNode(updates: Partial<Node>): Node {
  const node = diagramStore.addNode()
  Object.assign(node, updates)
  return node
}

function buildFkEdge(sourceNode: Node, targetNode: Node): Edge {
  const sourceAbsolute = diagramStore.getAbsoluteNodePosition(sourceNode)
  const targetAbsolute = diagramStore.getAbsoluteNodePosition(targetNode)
  const sourceCenterX = sourceAbsolute.x + sourceNode.width / 2
  const targetCenterX = targetAbsolute.x + targetNode.width / 2
  const isLeftToRight = sourceCenterX <= targetCenterX

  return {
    id: diagramStore.createEdgeId(),
    sourceNodeId: sourceNode.id,
    targetNodeId: targetNode.id,
    sourceSide: isLeftToRight ? 'right' : 'left',
    targetSide: isLeftToRight ? 'left' : 'right',
    label: `${sourceNode.text} -> ${targetNode.text}`,
    color: '#6b7280',
    width: 2,
    lineStyle: 'solid',
    markerType: 'triangle',
  }
}

async function loadTables(): Promise<void> {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    tables.value = await fetchDbInfo({
      ...connection,
      server: connection.server.trim(),
      database: connection.database.trim(),
      username: connection.username.trim(),
    })
    successMessage.value = `Загружено таблиц: ${tables.value.length}`
  } catch (error) {
    console.error('Не удалось получить схему БД', error)
    errorMessage.value = 'Не удалось загрузить список таблиц. Проверь параметры подключения.'
  } finally {
    isLoading.value = false
  }
}

async function addTableToDiagram(table: DbTableInfo): Promise<void> {
  if (props.readOnly) return

  const existingNode = findTableNode(table.tableName)
  if (existingNode) {
    editorUiStore.selectNode(existingNode.id)
    return
  }

  const parentNode = createNode({
    text: table.tableName,
    position: getNextTablePosition(),
    width: TABLE_WIDTH,
    height: TABLE_HEADER_HEIGHT + TABLE_PADDING * 2,
    color: '#f8fafc',
    borderColor: '#94a3b8',
    borderWidth: 2,
    borderRadius: 8,
    borderStyle: 'dashed',
    informationText: '',
    passThroughEdges: [],
  })

  const childNodes = table.columns.map((column, index) => createNode({
    text: column.columnName,
    parentId: parentNode.id,
    position: {
      x: TABLE_PADDING,
      y: TABLE_HEADER_HEIGHT + index * (COLUMN_HEIGHT + COLUMN_GAP),
    },
    width: COLUMN_WIDTH,
    height: COLUMN_HEIGHT,
    color: '#ffffff',
    borderColor: '#64748b',
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'solid',
    informationText: '',
    passThroughEdges: [],
  }))

  diagramStore.ensureParentPadding(parentNode.id, TABLE_PADDING)
  diagramStore.refreshParentBorders()

  const createdEdges: Edge[] = []
  const createdEdgeKeys = new Set<string>()

  function tryCreateEdge(sourceNode: Node | undefined, targetNode: Node | undefined): void {
    if (!sourceNode || !targetNode) return

    const edgeKey = `${sourceNode.id}->${targetNode.id}`
    if (createdEdgeKeys.has(edgeKey)) return
    if (diagramStore.edges.some(edge => edge.sourceNodeId === sourceNode.id && edge.targetNodeId === targetNode.id)) {
      return
    }

    createdEdgeKeys.add(edgeKey)
    createdEdges.push(diagramStore.addEdge(buildFkEdge(sourceNode, targetNode)))
  }

  table.columns.forEach((column, index) => {
    const foreignKey = column.foreignKeyInfo
    if (!foreignKey) return

    const sourceNode = childNodes[index]
    const targetNode = findColumnNode(foreignKey.referencedTable, foreignKey.referencedColumn)
    tryCreateEdge(sourceNode, targetNode)
  })

  tables.value
    .filter(item => item.tableName !== table.tableName)
    .forEach(knownTable => {
      knownTable.columns.forEach(column => {
        const foreignKey = column.foreignKeyInfo
        if (!foreignKey || foreignKey.referencedTable !== table.tableName) return

        const sourceNode = findColumnNode(knownTable.tableName, column.columnName)
        const targetNode = childNodes.find(node => node.text === foreignKey.referencedColumn)
        tryCreateEdge(sourceNode, targetNode)
      })
    })

  await diagramStore.finishNodeCreate(parentNode)
  for (const childNode of childNodes) {
    await diagramStore.finishNodeCreate(childNode)
  }
  for (const edge of createdEdges) {
    await diagramStore.finishEdgeCreate(edge)
  }

  try {
    await diagramStore.saveCurrentVersion()
  } catch (error) {
    console.error('Не удалось сохранить импортированную таблицу в текущую версию', error)
    errorMessage.value = 'Таблица добавлена на холст, но не сохранена в текущую версию схемы.'
  }

  editorUiStore.selectNode(parentNode.id)
}
</script>

<style scoped>
.db-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  background: #ffffff;
}

.db-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.db-form__row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.db-form__row label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.db-form__select {
  width: 100%;
}

.db-state {
  padding: 10px 16px;
  font-size: 13px;
  border-bottom: 1px solid #e5e7eb;
}

.db-state--error {
  color: #b42318;
  background: #fef3f2;
}

.db-state--success {
  color: #166534;
  background: #ecfdf3;
}

.db-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.db-list__header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.db-list__header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.db-list__search {
  width: 100%;
}

.db-list__empty {
  padding: 20px 16px;
  color: #6b7280;
  font-size: 13px;
}

.db-list__items {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.db-table-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border: 0;
  border-bottom: 1px solid #f1f5f9;
  background: #ffffff;
  text-align: left;
  cursor: pointer;
}

.db-table-item:hover {
  background: #f8fafc;
}

.db-table-item:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.db-table-item:disabled:hover {
  background: #ffffff;
}

.db-table-item--added {
  background: #f0fdf4;
}

.db-table-item__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 600;
  color: #111827;
}

.db-table-item__meta {
  flex-shrink: 0;
  font-size: 12px;
  color: #6b7280;
}
</style>
