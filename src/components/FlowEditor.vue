<template>
  <div class="flow-editor">
    <div class="editor-layout">
      <!-- Левая панель - редактор кода -->
      <div class="left-panel">
        <CodeEditor 
          v-model:content="diagramJson" 
          :error="jsonError"
          @focused="isEditorFocused = true"
          @blurred="isEditorFocused = false"
        />
      </div>

      <!-- Правая панель - холст -->
      <div class="right-panel">
        <div class="toolbar">
          <div class="toolbar-group icon-group">
            <button class="icon-btn" type="button" @click="addNode" title="Процесс" aria-label="Процесс">
              <img src="/icon/process.png" alt="Процесс">
            </button>
            <button class="icon-btn" type="button" @click="startConnectionMode" :class="{ active: isConnectionMode }"
              title="Поток данных" aria-label="Связь">
              <img src="/icon/connection.png" alt="Связь">
            </button>
            <button class="icon-btn" type="button" title="Внешняя система" aria-label="Внешняя система">
              <img src="/icon/external-system.png" alt="Внешняя система">
            </button>
            <button class="icon-btn" type="button" title="Пользователь" aria-label="Пользователь">
              <img src="/icon/user.png" alt="Пользователь">
            </button>
            <button class="icon-btn" type="button" title="Хранилище данных" aria-label="Хранилище данных">
              <img src="/icon/data-store.png" alt="Хранилище данных">
            </button>
            <button class="icon-btn" type="button" title="Комментарий" aria-label="Комментарий">
              <img src="/icon/comment.png" alt="Комментарий">
            </button>
            <button class="icon-btn" type="button" title="Граница системы" aria-label="Граница системы">
              <img src="/icon/boundary.png" alt="Граница системы">
            </button>
          </div>
          <div class="toolbar-right">
            <div class="stats">
              Узлов: {{ nodes.length }}
              <span v-if="edges.length">, Связей: {{ edges.length }}</span>
            </div>
            <button class="team-button" @click="showTeamModal = true" aria-label="Команда">
              <span class="team-avatars">
                <span class="avatar-circle">OP</span>
                <span class="avatar-circle">OP</span>
                <span class="avatar-circle">OP</span>
              </span>
              <span class="team-label">Команда</span>
            </button>
            <JsonExportButton
              class="save-btn"
              :nodes="nodes"
              :edges="edges"
            />
            <button class="save-btn" @click="exportAsPng">Сохранить PNG</button>
          </div>
        </div>

        <!-- Окно свойств -->
        <PropertiesPanel 
          :selected-object="selectedObject" 
          :edges="edges"
          @update:node="updateNode" 
          @update:edge="updateEdge"
          @delete:node="deleteNode" 
          @delete:edge="deleteEdge" 
          @clear-selection="clearSelection" 
        />

        <!-- снять выделение при нажатии на холст-->
        <div
          class="canvas"
          ref="canvas"
          @click="onCanvasClick"
          @wheel.prevent="onCanvasWheel"
        >
          <div class="canvas-content" :style="canvasTransformStyle" ref="canvasContent">

            <!-- Невидимое определение стрелки -->
            <ArrowDefinitions />

            <!-- Постоянные связи -->
            <GraphEdge 
              v-for="edge in edges" 
              :key="edge.id" 
              :edge="edge" 
              :nodes="nodes"
              :is-selected="selectedEdgeId === edge.id" 
              :show-drag-handle="showDragHandles"
              :get-connection-position="getConnectionPosition"
              :force-three-segments="edgeRequiresPassThrough[edge.id]"
              :has-pass-through-error="edgePassThroughErrors[edge.id]"
              :is-pass-through="edgeRequiresPassThrough[edge.id]"
              @edge-click="onEdgeClick"
              @breakpoint-drag-start="onBreakpointDragStart" 
            />

            <!-- Узлы -->
            <GraphNode 
              v-for="node in nodes" 
              :key="node.id" 
              :node="node" 
              :data-node-id="node.id"
              :selected="selectedNodeId === node.id" 
              :is-connection-source="isConnectionSource(node.id)"
              :is-connection-target="isConnectionTarget(node.id)" 
              :is-dragging="isDragging && selectedNodeId === node.id"
              :show-connection-hints="showConnectionHints" 
              :children-count="getChildrenCount(node.id)"
              :is-potential-parent="potentialParentId === node.id"
              :all-nodes="nodes"
              :has-pass-through-error="nodePassThroughErrors[node.id]"
              @node-mousedown="onNodeMouseDown" 
              @node-click="onNodeClick" 
              @node-hover-side="onNodeHoverSide" 
            />
          </div>
          <div class="canvas-zoom-controls">
            <button @click="zoomOut" aria-label="Уменьшить масштаб">-</button>
            <div class="zoom-indicator">{{ zoomPercent }}%</div>
            <button @click="zoomIn" aria-label="Увеличить масштаб">+</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showTeamModal" class="modal-backdrop" @click.self="showTeamModal = false">
      <div class="modal-window">
        <div class="modal-header">
          <span>Команда</span>
          <button class="close-btn" @click="showTeamModal = false" aria-label="Закрыть">×</button>
        </div>
        <div class="modal-body">
          <div class="team-section">
            <div class="section-title">Участники</div>
            <ul class="team-list">
              <li class="team-row" v-for="member in teamMembers" :key="member.email">
                <div class="member-info">
                  <div class="avatar-circle small">{{ member.initials }}</div>
                  <div class="member-text">
                    <div class="member-name">{{ member.name }}</div>
                    <div class="member-email">{{ member.email }}</div>
                  </div>
                </div>
                <span class="member-role">{{ member.role }}</span>
              </li>
            </ul>
          </div>

          <div class="team-section">
            <div class="section-title">Ссылка на схему</div>
            <div class="link-box">
              <span>{{ shareLink }}</span>
              <button class="copy-btn" type="button">Копировать</button>
            </div>
          </div>

          <div class="team-section">
            <div class="section-title">Добавить участника</div>
            <div class="invite-row">
              <input type="text" placeholder="email или имя пользователя" disabled>
              <select disabled>
                <option>Редактор</option>
                <option>Чтение</option>
              </select>
              <button type="button" disabled>Пригласить</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import GraphNode from './GraphNode.vue'
import GraphEdge from './GraphEdge.vue'
import ArrowDefinitions from './ArrowDefinitions.vue'
import CodeEditor from './CodeEditor.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import JsonExportButton from './JsonExportButton.vue'
import type { Node, Edge, ConnectionSide, EdgeGeometry, Position, Segment } from '../types'

// Состояние
const nodes = ref<Node[]>([
  {
    id: '1',
    position: { x: 50, y: 50 },
    text: 'Начальный узел',
    width: 150,
    height: 60,
    passThroughEdges: [],
    borderStyle: 'solid'
  },
  {
    id: '2',
    position: { x: 300, y: 150 },
    text: 'Процесс',
    width: 120,
    height: 60,
    passThroughEdges: [],
    borderStyle: 'solid'
  }
])

const edges = ref<Edge[]>([
  {
    id: 'e1',
    sourceNodeId: '1',
    targetNodeId: '2',
    sourceSide: 'right',
    targetSide: 'left',
    lineStyle: 'solid',
    markerType: 'triangle'
  }
])

const selectedObject = ref<{
  type: 'node' | 'edge'
  data: Node | Edge
  geometry?: EdgeGeometry
} | null>(null)

const jsonError = ref<string | null>(null)
const diagramJson = ref('')
const isUpdatingFromState = ref(false)
let applyTimeout: number | null = null
const isEditorFocused = ref(false)
const lastSerializedJson = ref('')

const edgeGeometries = computed(() => {
  const geometries: Record<string, EdgeGeometry> = {}
  return geometries
})

type SchemaPosition = { x: number; y: number }
type SchemaBlock = {
  id: string
  name: string
  information?: unknown
  position?: SchemaPosition
  width?: number
  height?: number
  parentId?: string | null
}
type SchemaConnection = {
  id: string
  startBlock?: string | null
  endBlock?: string | null
  startSide?: ConnectionSide | null
  endSide?: ConnectionSide | null
  label?: string | null
  dataKeys?: unknown
  through?: unknown
  breakpoints?: unknown
}

function extractInformation(meta?: Record<string, unknown> | null): string[] {
  if (!meta || typeof meta !== 'object') return []
  const info = (meta as Record<string, unknown>).information
  if (Array.isArray(info)) return info.filter((item): item is string => typeof item === 'string')
  if (typeof info === 'string') return [info]
  return []
}

function buildThroughMap(): Record<string, string[]> {
  return nodes.value.reduce<Record<string, string[]>>((acc, node) => {
    (node.passThroughEdges ?? []).forEach(edgeId => {
      if (!acc[edgeId]) acc[edgeId] = []
      acc[edgeId].push(node.id)
    })
    return acc
  }, {})
}

function extractBreakpoints(edge: Edge): SchemaPosition[] {
  if (edge.geometry?.segments?.length) {
    return edge.geometry.segments.slice(0, -1).map(segment => ({
      x: segment.end.x,
      y: segment.end.y
    }))
  }
  if (typeof edge.breakpointX === 'number' && typeof edge.breakpointY === 'number') {
    return [{ x: edge.breakpointX, y: edge.breakpointY }]
  }
  return []
}

function serializeDiagram() {
  const throughByEdgeId = buildThroughMap()

  return {
    blocks: nodes.value.map(node => ({
      id: node.id,
      name: node.text,
      information: extractInformation(node.meta),
      position: { x: node.position.x, y: node.position.y },
      width: node.width,
      height: node.height,
      parentId: node.parentId ?? null
    })),
    dataFlows: [],
    connections: edges.value.map(edge => ({
      id: edge.id,
      startBlock: edge.sourceNodeId ?? null,
      endBlock: edge.targetNodeId ?? null,
      startSide: edge.sourceSide ?? null,
      endSide: edge.targetSide ?? null,
      label: edge.label ?? null,
      dataKeys: [],
      through: throughByEdgeId[edge.id] ?? [],
      breakpoints: extractBreakpoints(edge)
    })),
    styles: { blocks: [], connections: [] }
  }
}

function updateDiagramJson(): void {
  const serialized = JSON.stringify(serializeDiagram(), null, 2)
  lastSerializedJson.value = serialized
  if (isEditorFocused.value && diagramJson.value !== serialized) {
    // Не перетираем пользовательский ввод, пока фокус в редакторе
    return
  }
  isUpdatingFromState.value = true
  diagramJson.value = serialized
  isUpdatingFromState.value = false
}

watch([nodes, edges], updateDiagramJson, { deep: true, immediate: true })

function debounceApplyFromEditor(): void {
  if (applyTimeout) {
    clearTimeout(applyTimeout)
  }
  applyTimeout = window.setTimeout(() => {
    applyTimeout = null
    applyDiagramJson(diagramJson.value)
  }, 400)
}

function normalizeConnectionSide(side: unknown): ConnectionSide {
  return side === 'top' || side === 'right' || side === 'bottom' || side === 'left' ? side : 'right'
}

function normalizeInformation(info: unknown): string[] {
  if (Array.isArray(info)) return info.filter((item): item is string => typeof item === 'string')
  if (typeof info === 'string') return [info]
  return []
}

function applyDiagramJson(raw: string): void {
  jsonError.value = null
  try {
    const parsed = JSON.parse(raw)
    const parsedBlocks: SchemaBlock[] = Array.isArray(parsed?.blocks) ? parsed.blocks : []
    const parsedConnections: SchemaConnection[] = Array.isArray(parsed?.connections) ? parsed.connections : []

    const passThroughByNode: Record<string, string[]> = {}
    parsedConnections.forEach(conn => {
      const through = Array.isArray(conn?.through) ? conn.through : []
      through.forEach(blockId => {
        const nodeId = String(blockId)
        if (!passThroughByNode[nodeId]) passThroughByNode[nodeId] = []
        if (conn?.id) passThroughByNode[nodeId].push(String(conn.id))
      })
    })

    const normalizedNodes: Node[] = parsedBlocks
      .map((b: SchemaBlock) => {
        if (!b?.id) return null
        const information = normalizeInformation((b as any).information)
        const meta = information.length ? { information } : null
        return {
          id: String(b.id),
          text: b.name ?? '',
          position: {
            x: typeof b.position?.x === 'number' ? b.position.x : 0,
            y: typeof b.position?.y === 'number' ? b.position.y : 0
          },
          width: typeof b.width === 'number' ? b.width : 120,
          height: typeof b.height === 'number' ? b.height : 60,
          parentId: b.parentId ?? null,
          passThroughEdges: passThroughByNode[String(b.id)] ?? [],
          borderStyle: 'solid',
          meta
        } as Node
      })
      .filter(Boolean) as Node[]

    const normalizedEdges: Edge[] = parsedConnections
      .map((c: SchemaConnection) => {
        if (!c?.id || !c?.startBlock || !c?.endBlock) return null
        const breakpoint = Array.isArray(c.breakpoints)
          ? (c.breakpoints as SchemaPosition[]).find(bp => typeof bp?.x === 'number' && typeof bp?.y === 'number')
          : null

        return {
          id: String(c.id),
          sourceNodeId: String(c.startBlock),
          targetNodeId: String(c.endBlock),
          sourceSide: normalizeConnectionSide(c.startSide),
          targetSide: normalizeConnectionSide(c.endSide),
          label: c.label ?? '',
          lineStyle: 'solid',
          markerType: 'triangle',
          breakpointX: breakpoint?.x,
          breakpointY: breakpoint?.y,
          breakpointLocked: false,
          geometry: undefined
        } as Edge
      })
      .filter(Boolean) as Edge[]

    nodes.value = normalizedNodes
    edges.value = normalizedEdges
    lastSerializedJson.value = JSON.stringify(serializeDiagram(), null, 2)
  } catch (err) {
    jsonError.value = err instanceof Error ? err.message : 'Не удалось разобрать JSON'
  }
}

watch(
  () => diagramJson.value,
  (val, prev) => {
    if (isUpdatingFromState.value) return
    if (val === prev) return
    debounceApplyFromEditor()
  }
)

function updateNode(nodeId: string, updates: Partial<Node>): void {
  const node = nodes.value.find(n => n.id === nodeId)
  if (node) {
    Object.assign(node, updates)
    maintainPassThroughEdges(nodeId)
  }
}

function updateEdge(edgeId: string, updates: Partial<Edge>): void {
  const edge = edges.value.find(e => e.id === edgeId)
  if (edge) {
    Object.assign(edge, updates)
  }
}

function deleteNode(nodeId: string): void {
  nodes.value = nodes.value.filter(n => n.id !== nodeId)
  // Также удаляем связанные стрелки
  edges.value = edges.value.filter(e =>
    e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId
  )
  clearSelection()
}

function deleteEdge(edgeId: string): void {
  edges.value = edges.value.filter(e => e.id !== edgeId)
  clearSelection()
}

function clearSelection(): void {
  selectedObject.value = null
  selectedNodeId.value = null
  selectedEdgeId.value = null
}



const selectedNodeId = ref<string | null>(null)
const isDragging = ref(false)
const canvas = ref<HTMLElement | null>(null)
const canvasContent = ref<HTMLElement | null>(null)
const selectedEdgeId = ref<string | null>(null)
const isDraggingBreakpoint = ref(false)
const draggingEdgeId = ref<string | null>(null)
const potentialParentId = ref<string | null>(null)
const CONTAINER_PADDING = 24

// Состояние для режима соединения
const isConnectionMode = ref(false)
const connectionStartNode = ref<string | null>(null)
const connectionStartSide = ref<ConnectionSide | null>(null)
const hoveredNodeId = ref<string | null>(null)
const hoveredNodeSide = ref<ConnectionSide | null>(null)

// Computed свойства для состояний узлов
const isConnectionSource = computed(() => (nodeId: string) => {
  return isConnectionMode.value && connectionStartNode.value === nodeId
})

const isConnectionTarget = computed(() => (nodeId: string) => {
  return isConnectionMode.value && !!connectionStartNode.value && connectionStartNode.value !== nodeId
})

const showDragHandles = computed((): boolean => {
  return selectedEdgeId.value !== null
})

// Computed свойство для показа подсказок
const showConnectionHints = computed((): boolean => {
  return isConnectionMode.value
})

const edgeRequiresPassThrough = computed<Record<string, boolean>>(() => {
  const flags: Record<string, boolean> = {}
  edges.value.forEach(edge => {
    flags[edge.id] = false
  })
  nodes.value.forEach(node => {
    const required = node.passThroughEdges || []
    required.forEach(edgeId => {
      flags[edgeId] = true
    })
  })
  return flags
})

const passThroughOffsets = computed(() => calculatePassThroughOffsets())
const passThroughStatus = computed(() => evaluatePassThroughStatus())
const nodePassThroughErrors = computed(() => passThroughStatus.value.nodeErrors)
const edgePassThroughErrors = computed(() => passThroughStatus.value.edgeErrors)

function alignAllPassThroughEdges(): void {
  if (isDraggingBreakpoint.value) return
  nodes.value.forEach(node => maintainPassThroughEdges(node.id))
}

watch(
  () => ({
    offsets: passThroughOffsets.value,
    nodes: nodes.value.map(n => ({
      id: n.id,
      pass: n.passThroughEdges,
      pos: n.position,
      size: { w: n.width, h: n.height }
    })),
    edges: edges.value.map(e => ({
      id: e.id,
      src: e.sourceNodeId,
      tgt: e.targetNodeId,
      sides: [e.sourceSide, e.targetSide]
    }))
  }),
  () => alignAllPassThroughEdges(),
  { deep: true, immediate: true }
)

const showTeamModal = ref(false)
const teamMembers = ref([
  { initials: 'OP', name: 'Иванов И.И.', email: 'ivanov@mail.ru', role: 'Редактор' },
  { initials: 'OP', name: 'Петров П.П.', email: 'petrov@mail.ru', role: 'Чтение' },
  { initials: 'OP', name: 'Сидоров С.С.', email: 'sidorov@mail.ru', role: 'Админ' }
])
const shareLink = ref('https://example.com/share/en-flow')

// Масштаб
const zoom = ref(1)
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1

const zoomPercent = computed(() => Math.round(zoom.value * 100))
const canvasTransformStyle = computed(() => ({
  transform: `scale(${zoom.value})`,
  transformOrigin: '0 0'
}))

// Округление координат для хранения без длинных дробей
function roundCoord(value: number, precision = 2): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function zoomIn(): void {
  zoom.value = Math.min(MAX_ZOOM, +(zoom.value + ZOOM_STEP).toFixed(2))
}

function zoomOut(): void {
  zoom.value = Math.max(MIN_ZOOM, +(zoom.value - ZOOM_STEP).toFixed(2))
}

function onCanvasWheel(event: WheelEvent): void {
  const delta = Math.sign(event.deltaY)
  if (delta > 0) {
    zoomOut()
  } else if (delta < 0) {
    zoomIn()
  }
}

// Клонирование DOM-дерева с инлайном вычисленных стилей (чтобы foreignObject отрисовал так же)
function cloneWithInlineStyles(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement

  const copyStyles = (source: Element, target: Element) => {
    const computed = getComputedStyle(source)
    const cssText = Array.from(computed)
      .map(prop => `${prop}: ${computed.getPropertyValue(prop)};`)
      .join(' ')
    ;(target as HTMLElement).setAttribute('style', cssText)

    const sourceChildren = Array.from(source.children)
    const targetChildren = Array.from(target.children)
    sourceChildren.forEach((child, index) => {
      const targetChild = targetChildren[index]
      if (child instanceof Element && targetChild instanceof Element) {
        copyStyles(child, targetChild)
      }
    })
  }

  copyStyles(element, clone)
  return clone
}

function getContentBounds() {
  let minX = 0
  let minY = 0
  let maxX = 0
  let maxY = 0

  nodes.value.forEach(node => {
    const absolute = getAbsoluteNodePosition(node)
    minX = Math.min(minX, absolute.x)
    minY = Math.min(minY, absolute.y)
    maxX = Math.max(maxX, absolute.x + node.width)
    maxY = Math.max(maxY, absolute.y + node.height)
  })

  // Минимальные размеры, чтобы не получить 0
  if (maxX === 0) maxX = 1
  if (maxY === 0) maxY = 1

  return { minX, minY, maxX, maxY }
}

async function exportAsPng(): Promise<void> {
  if (!canvasContent.value) return

  const node = canvasContent.value
  const bounds = getContentBounds()
  const padding = 32
  const width = Math.ceil(bounds.maxX - bounds.minX + padding * 2)
  const height = Math.ceil(bounds.maxY - bounds.minY + padding * 2)

  if (!width || !height) return

  // Клонируем содержимое, чтобы убрать transform: scale
  const cloned = cloneWithInlineStyles(node)
  cloned.style.transform = `translate(${padding - bounds.minX}px, ${padding - bounds.minY}px)`
  cloned.style.transformOrigin = '0 0'
  cloned.style.width = `${width}px`
  cloned.style.height = `${height}px`
  cloned.style.padding = '0'
  cloned.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')

  // Обертка с белой подложкой и нужными размерами
  const wrapper = document.createElement('div')
  wrapper.style.width = `${width}px`
  wrapper.style.height = `${height}px`
  wrapper.style.background = '#fff'
  wrapper.style.position = 'relative'
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml')
  wrapper.appendChild(cloned)

  const serializer = new XMLSerializer()
  const serialized = serializer.serializeToString(wrapper)

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        ${serialized}
      </foreignObject>
    </svg>
  `

  const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)

  await new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvasEl = document.createElement('canvas')
      canvasEl.width = width
      canvasEl.height = height
      const ctx = canvasEl.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        const pngUrl = canvasEl.toDataURL('image/png')
        const link = document.createElement('a')
        link.href = pngUrl
        link.download = 'diagram.png'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
      resolve()
    }
    img.onerror = (err) => {
      reject(err)
    }
    img.src = svgDataUrl
  })
}

// Методы
function addNode(): void {
  const newNode: Node = {
    id: Date.now().toString(),
    position: { x: 100, y: 100 + nodes.value.length * 80 },
    text: `Узел ${nodes.value.length + 1}`,
    width: 120,
    height: 60,
    passThroughEdges: [],
    borderStyle: 'solid'
  }
  nodes.value.push(newNode)
}

// Включаем режим создания связи
function startConnectionMode(): void {
  isConnectionMode.value = true
  connectionStartNode.value = null
  connectionStartSide.value = null
}

// Обработчик наведения на сторону узла
function onNodeHoverSide(nodeId: string, side: ConnectionSide | null): void {
  if (!isConnectionMode.value) return

  hoveredNodeId.value = nodeId
  hoveredNodeSide.value = side
}

// Обработчик клика по узлу в режиме соединения
function handleNodeClickInConnectionMode(nodeId: string): void {
  if (!isConnectionMode.value) return

  // Если сторона не выбрана (наведена), не создаем связь
  if (!hoveredNodeSide.value) return

  if (!connectionStartNode.value) {
    // Первый клик - выбираем начальный узел и сторону
    connectionStartNode.value = nodeId
    connectionStartSide.value = hoveredNodeSide.value
    console.log('Выбран начальный узел:', nodeId, 'сторона:', connectionStartSide.value)
  } else {
    // Второй клик - создаем связь
    if (connectionStartNode.value !== nodeId && hoveredNodeSide.value) {
      createConnection(
        connectionStartNode.value,
        connectionStartSide.value!,
        nodeId,
        hoveredNodeSide.value
      )
    }
    resetConnectionMode()
  }
}

// Создание связи между узлами
function createConnection(
  sourceId: string,
  sourceSide: ConnectionSide,
  targetId: string,
  targetSide: ConnectionSide
): void {
  // Проверяем, что связь не существует
  const existingEdge = edges.value.find(
    edge => edge.sourceNodeId === sourceId &&
      edge.targetNodeId === targetId
  )

  if (existingEdge) {
    console.log('Связь уже существует')
    return
  }

  // Создаем новую связь
  const newEdge: Edge = {
    id: `edge-${Date.now()}`,
    sourceNodeId: sourceId,
    targetNodeId: targetId,
    sourceSide: sourceSide,
    targetSide: targetSide,
    label: '',
    lineStyle: 'solid',
    markerType: 'triangle'
  }

  edges.value.push(newEdge)
  console.log('Создана связь:', sourceId, sourceSide, '→', targetId, targetSide)
}

// Обработчик клика по холсту
function onCanvasClick(event: MouseEvent): void {
  // Если клик по пустому месту в режиме соединения - сбрасываем режим
  if (isConnectionMode.value && !(event.target as Element).closest('.node')) {
    resetConnectionMode()
  }

  // Если клик по пустому месту - сбрасываем выделение
  if (!(event.target as Element).closest('.node') &&
    !(event.target as Element).closest('.edge')) {
    clearSelection()
  }
}

// Сброс режима соединения
function resetConnectionMode(): void {
  isConnectionMode.value = false
  connectionStartNode.value = null
  connectionStartSide.value = null
  hoveredNodeId.value = null
  hoveredNodeSide.value = null
}

function selectNode(nodeId: string): void {
  const node = nodes.value.find(n => n.id === nodeId)
  if (node) {
    selectedNodeId.value = nodeId
    selectedEdgeId.value = null
    selectedObject.value = {
      type: 'node',
      data: { ...node }
    }
  }
}

// Обработчик клика по узлу 
function onNodeClick(nodeId: string, event: MouseEvent): void {
  event.stopPropagation()

  if (isConnectionMode.value) {
    handleNodeClickInConnectionMode(nodeId) // Режим соединения
  } else {
    selectNode(nodeId) // Обычный режим
  }
}

// Функция для получения абсолютной позиции узла (с учетом родителя)
function getAbsoluteNodePosition(node: Node): Position {
  if (!node.parentId) {
    return node.position
  }
  
  const parent = nodes.value.find(n => n.id === node.parentId)
  if (!parent) {
    return node.position
  }
  
  const parentAbsolute = getAbsoluteNodePosition(parent)
  return {
    x: parentAbsolute.x + node.position.x,
    y: parentAbsolute.y + node.position.y
  }
}

// Получить все дочерние узлы (рекурсивно)
function getAllChildren(nodeId: string): Node[] {
  const children: Node[] = []
  const directChildren = nodes.value.filter(n => n.parentId === nodeId)
  
  for (const child of directChildren) {
    children.push(child)
    children.push(...getAllChildren(child.id))
  }
  
  return children
}

// Перетаскивание 
function startDrag(nodeId: string, event: MouseEvent): void {
  if (isConnectionMode.value) {
    event.preventDefault()
    return
  }

  const node = nodes.value.find(n => n.id === nodeId)
  if (!node) return

  isDragging.value = true
  selectedNodeId.value = nodeId

  const startMouseX = event.clientX
  const startMouseY = event.clientY
  
  // Получаем абсолютную позицию узла (с учетом родителя)
  const absolutePos = getAbsoluteNodePosition(node)
  const startNodeX = absolutePos.x
  const startNodeY = absolutePos.y

  // Сохраняем начальные позиции всех дочерних узлов
  const children = getAllChildren(nodeId)
  const childrenStartPositions = new Map<string, Position>()
  children.forEach(child => {
    childrenStartPositions.set(child.id, { ...child.position })
  })

  const tempNode = {
    id: nodeId,
    dx: 0,
    dy: 0
  }

  let potentialParent: Node | null = null

  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!isDragging.value) return

    const scale = zoom.value || 1
    const deltaX = (moveEvent.clientX - startMouseX) / scale
    const deltaY = (moveEvent.clientY - startMouseY) / scale

    tempNode.dx = deltaX
    tempNode.dy = deltaY

    // Применяем трансформацию к узлу и всем его детям
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement
    if (nodeElement) {
      nodeElement.style.setProperty('--drag-dx', `${deltaX}px`)
      nodeElement.style.setProperty('--drag-dy', `${deltaY}px`)
    }
    
    // Применяем трансформацию к дочерним узлам
    children.forEach(child => {
      const childElement = document.querySelector(`[data-node-id="${child.id}"]`) as HTMLElement
      if (childElement) {
        childElement.style.setProperty('--drag-dx', `${deltaX}px`)
        childElement.style.setProperty('--drag-dy', `${deltaY}px`)
      }
    })

    const currentX = startNodeX + deltaX
    const currentY = startNodeY + deltaY

    // Ищем потенциального родителя (исключаем текущего родителя и дочерние узлы)
    potentialParent = findPotentialParent(nodeId, currentX, currentY, node.width, node.height)
    
    highlightPotentialParent(potentialParent)
  }

  const onMouseUp = () => {
    const deltaX = tempNode.dx
    const deltaY = tempNode.dy

    // Вычисляем новую абсолютную позицию
    const newAbsoluteX = roundCoord(Math.max(0, startNodeX + deltaX))
    const newAbsoluteY = roundCoord(Math.max(0, startNodeY + deltaY))

    // Убираем CSS трансформации
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement
    if (nodeElement) {
      nodeElement.style.removeProperty('--drag-dx')
      nodeElement.style.removeProperty('--drag-dy')
    }
    
    children.forEach(child => {
      const childElement = document.querySelector(`[data-node-id="${child.id}"]`) as HTMLElement
      if (childElement) {
        childElement.style.removeProperty('--drag-dx')
        childElement.style.removeProperty('--drag-dy')
      }
    })

    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)

    if (potentialParent && potentialParent.id !== node.parentId) {
      // Перемещаем узел к новому родителю
      moveNodeToParent(nodeId, potentialParent.id, newAbsoluteX, newAbsoluteY)
      
      // Обновляем позиции дочерних узлов (они остаются относительно родителя)
      // Позиции дочерних узлов не меняются, так как они относительные
    } else if (!potentialParent && node.parentId) {
      // Если перетащили из контейнера на пустое место - делаем корневым
      moveNodeToParent(nodeId, null, newAbsoluteX, newAbsoluteY)
      
      // Обновляем позиции дочерних узлов - они становятся корневыми или остаются относительно нового родителя
      // Позиции дочерних узлов нужно пересчитать в абсолютные
      children.forEach(child => {
        const childAbsolutePos = getAbsoluteNodePosition(child)
        moveNodeToParent(child.id, null, roundCoord(childAbsolutePos.x), roundCoord(childAbsolutePos.y))
      })
    } else {
      // Обычное перемещение (обновляем позицию с учетом родителя)
      if (node.parentId) {
        // Если узел вложен, обновляем относительную позицию
        const parent = nodes.value.find(n => n.id === node.parentId)
        if (parent) {
          const parentAbsolute = getAbsoluteNodePosition(parent)
          let relativeX = newAbsoluteX - parentAbsolute.x
          let relativeY = newAbsoluteY - parentAbsolute.y
          
          relativeX = roundCoord(Math.max(CONTAINER_PADDING, relativeX))
          relativeY = roundCoord(Math.max(CONTAINER_PADDING, relativeY))
          
          node.position.x = relativeX
          node.position.y = relativeY
          ensureParentPadding(parent.id)
        }
      } else {
        // Если узел корневой, просто обновляем позицию
        node.position.x = newAbsoluteX
        node.position.y = newAbsoluteY
      }
      
      // Дочерние узлы автоматически перемещаются вместе с родителем,
      // так как их позиции относительные к родителю
    }

    maintainPassThroughEdges(nodeId)
    clearParentHighlights()
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  event.preventDefault()
  event.stopPropagation()
}

// Обработчик начала перетаскивания
function onNodeMouseDown(nodeId: string, event: MouseEvent): void {
  if (isConnectionMode.value) {
    event.preventDefault()
    return
  }

  startDrag(nodeId, event)
}

// Обработчик клика по стрелке
function onEdgeClick(edgeId: string, event: MouseEvent): void {
  const edge = edges.value.find(e => e.id === edgeId)
  if (edge) {
    selectedEdgeId.value = edgeId
    selectedNodeId.value = null
    selectedObject.value = {
      type: 'edge',
      data: { ...edge },
      geometry: edgeGeometries.value[edgeId]
    }
  }
  event.stopPropagation()
}

// Начало перетаскивания точки излома
function onBreakpointDragStart(edgeId: string, event: MouseEvent): void {
  isDraggingBreakpoint.value = true
  draggingEdgeId.value = edgeId

  const edge = edges.value.find(e => e.id === edgeId)
  if (!edge) return
  edge.breakpointLocked = true

  const { sourceSide, targetSide } = edge

  // Определяем ось перетаскивания для всех типов 3-сегментных стрелок
  let axis: 'x' | 'y' = 'x'

  if ((sourceSide === 'left' && targetSide === 'right') ||
    (sourceSide === 'right' && targetSide === 'left') ||
    (sourceSide === 'left' && targetSide === 'left') ||
    (sourceSide === 'right' && targetSide === 'right')) {
    axis = 'x' // Перетаскивание по X для всех горизонтальных соединений
  } else {
    axis = 'y' // Перетаскивание по Y для вертикальных соединений
  }

  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!isDraggingBreakpoint.value || !draggingEdgeId.value || !canvas.value) return

    const edge = edges.value.find(e => e.id === draggingEdgeId.value)
    if (!edge) return

    const canvasRect = canvas.value.getBoundingClientRect()

    if (axis === 'x') {
      const newX = moveEvent.clientX - canvasRect.left
      edge.breakpointX = roundCoord(clampXValue(edge, newX))
    } else {
      const newY = moveEvent.clientY - canvasRect.top
      edge.breakpointY = roundCoord(clampYValue(edge, newY))
    }
  }

  const onMouseUp = () => {
    isDraggingBreakpoint.value = false
    draggingEdgeId.value = null
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  event.preventDefault()
  event.stopPropagation()
}

// Функции ограничения значений
function clampXValue(edge: Edge, x: number): number {
  const sourceNode = nodes.value.find(n => n.id === edge.sourceNodeId)
  const targetNode = nodes.value.find(n => n.id === edge.targetNodeId)

  if (!sourceNode || !targetNode) return x

  // Для одинаковых левых сторон - точка излома должна быть слева от узлов
  if (edge.sourceSide === 'left' && edge.targetSide === 'left') {
    const minX = Math.min(sourceNode.position.x, targetNode.position.x) - 200
    const maxX = Math.min(sourceNode.position.x, targetNode.position.x) - 20
    return Math.max(minX, Math.min(maxX, x))
  }

  // Для одинаковых правых сторон - точка излома должна быть справа от узлов
  if (edge.sourceSide === 'right' && edge.targetSide === 'right') {
    const minX = Math.max(
      sourceNode.position.x + sourceNode.width,
      targetNode.position.x + targetNode.width
    ) + 20
    const maxX = Math.max(
      sourceNode.position.x + sourceNode.width,
      targetNode.position.x + targetNode.width
    ) + 200
    return Math.max(minX, Math.min(maxX, x))
  }

  // Для противоположных сторон (лево-право, право-лево) - точка излома между узлами
  const minX = Math.min(sourceNode.position.x, targetNode.position.x) + 10
  const maxX = Math.max(
    sourceNode.position.x + sourceNode.width,
    targetNode.position.x + targetNode.width
  ) - 10

  return Math.max(minX, Math.min(maxX, x))
}

function clampYValue(edge: Edge, y: number): number {
  const sourceNode = nodes.value.find(n => n.id === edge.sourceNodeId)
  const targetNode = nodes.value.find(n => n.id === edge.targetNodeId)

  if (!sourceNode || !targetNode) return y

  // Для одинаковых верхних сторон - точка излома должна быть сверху от узлов
  if (edge.sourceSide === 'top' && edge.targetSide === 'top') {
    const minY = Math.min(sourceNode.position.y, targetNode.position.y) - 200
    const maxY = Math.min(sourceNode.position.y, targetNode.position.y) - 20
    return Math.max(minY, Math.min(maxY, y))
  }

  // Для одинаковых нижних сторон - точка излома должна быть снизу от узлов
  if (edge.sourceSide === 'bottom' && edge.targetSide === 'bottom') {
    const minY = Math.max(
      sourceNode.position.y + sourceNode.height,
      targetNode.position.y + targetNode.height
    ) + 20
    const maxY = Math.max(
      sourceNode.position.y + sourceNode.height,
      targetNode.position.y + targetNode.height
    ) + 200
    return Math.max(minY, Math.min(maxY, y))
  }

  // Для противоположных сторон (верх-низ, низ-верх) - точка излома между узлами
  const minY = Math.min(sourceNode.position.y, targetNode.position.y) + 10
  const maxY = Math.max(
    sourceNode.position.y + sourceNode.height,
    targetNode.position.y + targetNode.height
  ) - 10

  return Math.max(minY, Math.min(maxY, y))
}

// Вычисляем позиции для соединений на каждой стороне каждого узла
const connectionPositions = computed(() => {
  const positions: Record<string, Record<ConnectionSide, string[]>> = {}

  // Инициализируем структуру для всех узлов
  nodes.value.forEach(node => {
    positions[node.id] = {
      top: [],
      right: [],
      bottom: [],
      left: []
    }
  })

  // Собираем все соединения по узлам и сторонам
  edges.value.forEach(edge => {
    positions[edge.sourceNodeId][edge.sourceSide].push(edge.id)
    positions[edge.targetNodeId][edge.targetSide].push(edge.id)
  })

  return positions
})

// Функция для получения позиции соединения на стороне
function getConnectionPosition(nodeId: string, side: ConnectionSide, connectionId: string): number {
  const connections = connectionPositions.value[nodeId]?.[side] || []
  const index = connections.indexOf(connectionId)

  if (index === -1) return 0.5 // По умолчанию середина

  return (index + 1) / (connections.length + 1)
}

//Поиск потенциального родителя
function findPotentialParent(draggedNodeId: string, x: number, y: number, width: number, height: number): Node | null {
  const draggedNodeRect = { 
    x: x, 
    y: y, 
    width, 
    height 
  }
  
  // Получаем все дочерние узлы, чтобы исключить их из поиска
  const allChildren = getAllChildren(draggedNodeId)
  const childrenIds = new Set(allChildren.map(c => c.id))
  childrenIds.add(draggedNodeId)
  
  for (const node of nodes.value) {
    // Пропускаем сам узел, его детей и узлы, которые являются его потомками
    if (childrenIds.has(node.id)) continue
    
    // Получаем абсолютную позицию узла (с учетом его родителя)
    const nodeAbsolutePos = getAbsoluteNodePosition(node)
    const nodeRect = {
      x: nodeAbsolutePos.x,
      y: nodeAbsolutePos.y,
      width: node.width,
      height: node.height
    }
    
    // Проверяем: центр перетаскиваемого узла внутри потенциального родителя
    const draggedCenterX = draggedNodeRect.x + draggedNodeRect.width / 2
    const draggedCenterY = draggedNodeRect.y + draggedNodeRect.height / 2
    
    const isInside = 
      draggedCenterX >= nodeRect.x && 
      draggedCenterX <= nodeRect.x + nodeRect.width &&
      draggedCenterY >= nodeRect.y && 
      draggedCenterY <= nodeRect.y + nodeRect.height
    
    if (isInside) {
      return node
    }
  }
  return null
}

//Подсветка потенциального родителя
function highlightPotentialParent(parent: Node | null): void {
  potentialParentId.value = parent ? parent.id : null
}

//Сброс подсветок
function clearParentHighlights(): void {
  potentialParentId.value = null
}

//Перемещение узла к родителю
function moveNodeToParent(nodeId: string, parentId: string | null, absoluteX?: number, absoluteY?: number): void {
  const node = nodes.value.find(n => n.id === nodeId)
  if (!node) return
  const previousParentId = node.parentId
  
  // Получаем текущую абсолютную позицию, если не передана
  const currentAbsolutePos = absoluteX !== undefined && absoluteY !== undefined 
    ? { x: absoluteX, y: absoluteY }
    : getAbsoluteNodePosition(node)
  
  if (parentId) {
    const parent = nodes.value.find(n => n.id === parentId)
    if (parent) {
      // Получаем абсолютную позицию родителя
      const parentAbsolutePos = getAbsoluteNodePosition(parent)
      
      // Вычисляем позицию относительно родителя
      const relativeX = roundCoord(currentAbsolutePos.x - parentAbsolutePos.x)
      const relativeY = roundCoord(currentAbsolutePos.y - parentAbsolutePos.y)
      
      // Устанавливаем относительную позицию с отступом от краев
      node.position.x = roundCoord(Math.max(CONTAINER_PADDING, relativeX))
      node.position.y = roundCoord(Math.max(CONTAINER_PADDING, relativeY))
      node.parentId = parentId
      ensureParentPadding(parentId)
      
      console.log(`Узел ${nodeId} вложен в узел ${parentId}`)
    }
  } else {
    // Если перетащили на пустое место - делаем корневым узлом
    node.position.x = roundCoord(currentAbsolutePos.x)
    node.position.y = roundCoord(currentAbsolutePos.y)
    node.parentId = undefined
    
    console.log(`Узел ${nodeId} стал корневым`)
  }
  
  maintainPassThroughEdges(nodeId)
  updateParentBorder(parentId)
  updateParentBorder(previousParentId)
}

function ensureParentPadding(parentId: string | null | undefined): void {
  if (!parentId) return
  const parent = nodes.value.find(n => n.id === parentId)
  if (!parent) return
  
  const children = nodes.value.filter(n => n.parentId === parentId)
  if (!children.length) return
  
  let requiredWidth = parent.width
  let requiredHeight = parent.height
  
  children.forEach(child => {
    requiredWidth = Math.max(requiredWidth, child.position.x + child.width + CONTAINER_PADDING)
    requiredHeight = Math.max(requiredHeight, child.position.y + child.height + CONTAINER_PADDING)
  })
  
  parent.width = requiredWidth
  parent.height = requiredHeight
  maintainPassThroughEdges(parentId)
  ensureParentPadding(parent.parentId)
}

function updateParentBorder(parentId: string | null | undefined): void {
  if (!parentId) return
  const parent = nodes.value.find(n => n.id === parentId)
  if (!parent) return
  const childrenCount = nodes.value.filter(n => n.parentId === parentId).length
  parent.borderStyle = childrenCount > 0 ? 'dashed' : 'solid'
}

function maintainPassThroughEdges(nodeId: string | null | undefined): void {
  if (!nodeId) return
  const node = nodes.value.find(n => n.id === nodeId)
  if (!node || !node.passThroughEdges?.length) return
  node.passThroughEdges.forEach(edgeId => {
    const edge = edges.value.find(e => e.id === edgeId)
    if (!edge || edge.breakpointLocked) return
    alignEdgeToNode(edge, node)
  })
}

function alignEdgeToNode(edge: Edge, node: Node): void {
  const rect = getNodeRect(node)
  const isHorizontalEdge = isHorizontalPassThroughEdge(edge)
  const isVerticalEdge = isVerticalPassThroughEdge(edge)
  
  if (isHorizontalEdge) {
    const fraction = getPassThroughFraction(node.id, edge.id, 'horizontal')
    edge.breakpointX = roundCoord(rect.left + rect.width * fraction)
  } else if (isVerticalEdge) {
    const fraction = getPassThroughFraction(node.id, edge.id, 'vertical')
    edge.breakpointY = roundCoord(rect.top + rect.height * fraction)
  }
}

function evaluatePassThroughStatus(): { nodeErrors: Record<string, boolean>, edgeErrors: Record<string, boolean> } {
  const nodeErrors: Record<string, boolean> = {}
  const edgeErrors: Record<string, boolean> = {}
  
  nodes.value.forEach(node => {
    const requiredEdges = node.passThroughEdges || []
    if (!requiredEdges.length) {
      nodeErrors[node.id] = false
      return
    }
    
    let hasError = false
    requiredEdges.forEach(edgeId => {
      const edge = edges.value.find(e => e.id === edgeId)
      if (!edge) {
        hasError = true
        edgeErrors[edgeId] = true
        return
      }
      
      const passes = doesEdgePassThroughNode(edge, node)
      if (!passes) {
        hasError = true
        edgeErrors[edgeId] = true
      } else if (!(edgeId in edgeErrors)) {
        edgeErrors[edgeId] = false
      }
    })
    
    nodeErrors[node.id] = hasError
  })
  
  edges.value.forEach(edge => {
    if (!(edge.id in edgeErrors)) {
      edgeErrors[edge.id] = false
    }
  })
  
  return { nodeErrors, edgeErrors }
}

function doesEdgePassThroughNode(edge: Edge, node: Node): boolean {
  const segments = getEdgeSegments(edge)
  if (!segments.length) return false
  
  const rect = getNodeRect(node)
  const boundaries = new Set<string>()
  
  segments.forEach(segment => collectBoundaryHits(segment, rect, boundaries))
  
  return boundaries.size >= 2
}

function calculatePassThroughOffsets(): Record<string, { horizontal: Record<string, number>, vertical: Record<string, number> }> {
  const layout: Record<string, { horizontal: Record<string, number>, vertical: Record<string, number> }> = {}
  
  nodes.value.forEach(node => {
    const required = node.passThroughEdges || []
    if (!required.length) return
    
    const horizontal: Record<string, number> = {}
    const vertical: Record<string, number> = {}
    
    const horizontalEdges = required
      .map(edgeId => edges.value.find(e => e.id === edgeId))
      .filter((edge): edge is Edge => !!edge && isHorizontalPassThroughEdge(edge))
      .sort((a, b) => a.id.localeCompare(b.id))
    const verticalEdges = required
      .map(edgeId => edges.value.find(e => e.id === edgeId))
      .filter((edge): edge is Edge => !!edge && isVerticalPassThroughEdge(edge))
      .sort((a, b) => a.id.localeCompare(b.id))
    
    horizontalEdges.forEach((edge, index) => {
      const fraction = (index + 1) / (horizontalEdges.length + 1)
      horizontal[edge.id] = fraction
    })
    
    verticalEdges.forEach((edge, index) => {
      const fraction = (index + 1) / (verticalEdges.length + 1)
      vertical[edge.id] = fraction
    })
    
    layout[node.id] = { horizontal, vertical }
  })
  
  return layout
}

function isHorizontalPassThroughEdge(edge: Edge): boolean {
  const sides = ['left', 'right']
  return sides.includes(edge.sourceSide) && sides.includes(edge.targetSide)
}

function isVerticalPassThroughEdge(edge: Edge): boolean {
  const sides = ['top', 'bottom']
  return sides.includes(edge.sourceSide) && sides.includes(edge.targetSide)
}

function getPassThroughFraction(
  nodeId: string,
  edgeId: string,
  orientation: 'horizontal' | 'vertical'
): number {
  const layout = passThroughOffsets.value[nodeId]
  if (!layout) return 0.5
  const fraction = layout[orientation][edgeId]
  return fraction ?? 0.5
}

function getNodeRect(node: Node) {
  const absolute = getAbsoluteNodePosition(node)
  return {
    left: absolute.x,
    right: absolute.x + node.width,
    top: absolute.y,
    bottom: absolute.y + node.height,
    width: node.width,
    height: node.height
  }
}

function collectBoundaryHits(segment: Segment, rect: { left: number, right: number, top: number, bottom: number }, boundaries: Set<string>): void {
  const isVertical = segment.start.x === segment.end.x
  const isHorizontal = segment.start.y === segment.end.y
  const minX = Math.min(segment.start.x, segment.end.x)
  const maxX = Math.max(segment.start.x, segment.end.x)
  const minY = Math.min(segment.start.y, segment.end.y)
  const maxY = Math.max(segment.start.y, segment.end.y)
  
  if (isVertical) {
    const x = segment.start.x
    if (x >= rect.left && x <= rect.right) {
      if (minY < rect.top && maxY > rect.top) {
        boundaries.add('top')
      }
      if (minY < rect.bottom && maxY > rect.bottom) {
        boundaries.add('bottom')
      }
    }
  } else if (isHorizontal) {
    const y = segment.start.y
    if (y >= rect.top && y <= rect.bottom) {
      if (minX < rect.left && maxX > rect.left) {
        boundaries.add('left')
      }
      if (minX < rect.right && maxX > rect.right) {
        boundaries.add('right')
      }
    }
  }
}

function getEdgeSegments(edge: Edge): Segment[] {
  const start = getConnectionPointForEdge(edge.sourceNodeId, edge.sourceSide, edge.id)
  const end = getConnectionPointForEdge(edge.targetNodeId, edge.targetSide, edge.id)
  if (!start || !end) {
    return []
  }
  
  const segments: Segment[] = []
  let currentPoint = start
  const { sourceSide, targetSide } = edge
  const needsThreeSegments =
    (sourceSide === 'left' && targetSide === 'right') ||
    (sourceSide === 'right' && targetSide === 'left') ||
    (sourceSide === 'top' && targetSide === 'bottom') ||
    (sourceSide === 'bottom' && targetSide === 'top') ||
    (sourceSide === 'left' && targetSide === 'left') ||
    (sourceSide === 'right' && targetSide === 'right')
  
  if (needsThreeSegments || edge.breakpointX !== undefined || edge.breakpointY !== undefined) {
    const breakpointX = edge.breakpointX ?? ((start.x + end.x) / 2)
    const breakpointY = edge.breakpointY ?? ((start.y + end.y) / 2)
    
    if (sourceSide === 'left' || sourceSide === 'right') {
      const point1 = { x: breakpointX, y: start.y }
      const point2 = { x: breakpointX, y: end.y }
      segments.push({ id: `${edge.id}-segment-1`, type: 'line', start: currentPoint, end: point1 })
      currentPoint = point1
      segments.push({ id: `${edge.id}-segment-2`, type: 'line', start: currentPoint, end: point2 })
      currentPoint = point2
      segments.push({ id: `${edge.id}-segment-3`, type: 'line', start: currentPoint, end })
    } else {
      const point1 = { x: start.x, y: breakpointY }
      const point2 = { x: end.x, y: breakpointY }
      segments.push({ id: `${edge.id}-segment-1`, type: 'line', start: currentPoint, end: point1 })
      currentPoint = point1
      segments.push({ id: `${edge.id}-segment-2`, type: 'line', start: currentPoint, end: point2 })
      currentPoint = point2
      segments.push({ id: `${edge.id}-segment-3`, type: 'line', start: currentPoint, end })
    }
  } else {
    let bendPoint: Position
    if (sourceSide === 'left' || sourceSide === 'right') {
      bendPoint = { x: end.x, y: start.y }
    } else {
      bendPoint = { x: start.x, y: end.y }
    }
    segments.push({ id: `${edge.id}-segment-1`, type: 'line', start, end: bendPoint })
    segments.push({ id: `${edge.id}-segment-2`, type: 'line', start: bendPoint, end })
  }
  
  return segments
}

function getConnectionPointForEdge(nodeId: string, side: ConnectionSide, edgeId: string): Position | null {
  const node = nodes.value.find(n => n.id === nodeId)
  if (!node) return null
  const absolutePosition = getAbsoluteNodePosition(node)
  const position = getConnectionPosition(nodeId, side, edgeId)
  
  switch (side) {
    case 'top':
      return { x: absolutePosition.x + node.width * position, y: absolutePosition.y }
    case 'right':
      return { x: absolutePosition.x + node.width, y: absolutePosition.y + node.height * position }
    case 'bottom':
      return { x: absolutePosition.x + node.width * position, y: absolutePosition.y + node.height }
    case 'left':
      return { x: absolutePosition.x, y: absolutePosition.y + node.height * position }
    default:
      return null
  }
}

function getChildrenCount(nodeId: string): number {
  return nodes.value.filter(n => n.parentId === nodeId).length
}



</script>

<style scoped>
.flow-editor {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.editor-layout {
  flex: 1;
  display: flex;
  height: 100%;
}

.left-panel {
  width: 400px;
  /* Ширина редактора кода */
  min-width: 300px;
  background: white;
  border-right: 1px solid #dee2e6;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* Для правильного flexbox */
}

.toolbar {
  padding: 12px 20px;
  background: #ebebeb;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toolbar button {
  padding: 8px 16px;
  background: #ffffff;
  color: #066664;
  border: 1px solid #066664;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-group {
  gap: 6px;
}

.icon-btn {
  width: 40px;
  min-width: 40px;
  padding: 0;
  font-size: 18px;
  background: #ffffff;
  border: 1px solid #066664;
  height: 40px;
  justify-content: center;
}

.icon-btn img {
  width: 16px;
  height: 16px;
  filter: invert(19%) sepia(59%) saturate(808%) hue-rotate(130deg) brightness(94%) contrast(96%);
}

.team-button {
  background: #ffffff !important;
  color: #000000 !important;
  border: 1px solid #e1e5ea;
  box-shadow: none;
  border-radius: 100px !important;
}

.team-button:hover {
  background: #f5f5f5 !important;
  color: #111 !important;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.save-btn {
  background: #066664 !important;
  color: #ffffff !important;
  border: 1px solid #066664 !important;
}

.save-btn:hover {
  background: #044746 !important;
  color: #ffffff !important;
}

.toolbar button:hover {
  background: #e6f4f1;
}

.toolbar button.active {
  background: #94bea9;
  color: #fff;
  box-shadow: 0 0 0 2px rgba(6, 102, 100, 0.25);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-indicator {
  min-width: 52px;
  text-align: center;
  font-weight: 600;
  color: #343a40;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.team-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #ffffff;
  border: 1px solid #e1e5ea;
  border-radius: 999px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.1s;
  height: 40px;
}

.team-button:hover {
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.team-button:active {
  transform: translateY(1px);
}

.team-button {
  color: #111 !important;
}

.team-label {
  color: #111 !important;
}

.team-avatars {
  display: inline-flex;
  gap: 6px;
}

.avatar-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #c0c2c5;
  color: #fff;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.team-label {
  color: #ffffff;
}

.canvas-zoom-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 4px 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  z-index: 5;
}

.canvas-zoom-controls button {
  padding: 8px 12px;
  background: #ffffff;
  color: #000000;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  transition: background 0.2s;
}

.canvas-zoom-controls button:hover {
  background: #08a180;
}

.canvas-zoom-controls .zoom-indicator {
  font-weight: 700;
  color: #343a40;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.modal-window {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  width: 460px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 700;
  margin-bottom: 12px;
}

.modal-body {
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 4px;
}

.team-section {
  margin-bottom: 14px;
}

.section-title {
  font-weight: 700;
  margin-bottom: 8px;
}

.team-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.team-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: #f8f9fa;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatar-circle.small {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #c0c2c5;
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.member-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-weight: 700;
}

.member-email {
  font-size: 12px;
  color: #555;
}

.member-role {
  font-size: 12px;
  font-weight: 600;
  color: #066664;
}

.link-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: #f8f9fa;
  font-size: 12px;
}

.copy-btn {
  padding: 6px 10px;
  border: 1px solid #e1e5ea;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.invite-row {
  display: grid;
  grid-template-columns: 1fr 140px 110px;
  gap: 8px;
}

.invite-row input,
.invite-row select,
.invite-row button {
  height: 32px;
  border-radius: 6px;
  border: 1px solid #e1e5ea;
  padding: 0 10px;
  font-size: 12px;
}

.invite-row button {
  background: #066664;
  color: #fff;
  cursor: not-allowed;
}

.hint {
  margin-top: 6px;
  font-size: 11px;
  color: #777;
}

.connection-hint {
  color: #28a745;
  font-weight: bold;
}

.stats {
  color: #6c757d;
  font-size: 14px;
}

.canvas {
  flex: 1;
  position: relative;
  background:
    linear-gradient(90deg, #f0f0f0 1px, transparent 1px),
    linear-gradient(#f0f0f0 1px, transparent 1px);
  background-size: 20px 20px;
  overflow: auto;
  cursor: default;
  z-index: 1;
}

.canvas-content {
  position: relative;
  width: max-content;
  height: max-content;
  transform-origin: 0 0;
  padding: 24px;
}

:deep(.node.potential-parent) {
  box-shadow: 0 0 0 3px #28a745;
  background: rgba(40, 167, 69, 0.1);
}

/* Адаптивность */
@media (max-width: 768px) {
  .editor-layout {
    flex-direction: column;
  }

  .left-panel {
    width: 100%;
    height: 200px;
  }
}
</style>
