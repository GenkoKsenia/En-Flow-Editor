<template>
  <div class="flow-editor">
    <div class="editor-layout">
      <!-- Левая панель - редактор кода -->
      <div class="left-panel">
        <CodeEditor />
      </div>

      <!-- Правая панель - холст -->
      <div class="right-panel">
        <div class="toolbar">
          <button @click="addNode">Процесс</button>
          <button @click="startConnectionMode" :class="{ active: isConnectionMode }"
            title="Создать связь между узлами">Связь</button>
          <div class="stats">
            Узлов: {{ nodes.length }}
            <span v-if="edges.length">, Связей: {{ edges.length }}</span>
          </div>
        </div>

        <!-- Окно свойств -->
        <PropertiesPanel :selected-object="selectedObject" @update:node="updateNode" @update:edge="updateEdge"
          @delete:node="deleteNode" @delete:edge="deleteEdge" @clear-selection="clearSelection" />

        <!-- снять выделение при нажатии на холст-->
        <div class="canvas" ref="canvas" @click="onCanvasClick">

          <!-- Невидимое определение стрелки -->
          <ArrowDefinitions />

          <!-- Постоянные связи -->
          <GraphEdge v-for="edge in edges" :key="edge.id" :edge="edge" :nodes="nodes"
            :is-selected="selectedEdgeId === edge.id" :show-drag-handle="showDragHandles"
            :get-connection-position="getConnectionPosition" @edge-click="onEdgeClick"
            @breakpoint-drag-start="onBreakpointDragStart" />

          <!-- Узлы -->
          <GraphNode v-for="node in nodes" :key="node.id" :node="node" :data-node-id="node.id"
            :selected="selectedNodeId === node.id" :is-connection-source="isConnectionSource(node.id)"
            :is-connection-target="isConnectionTarget(node.id)" :is-dragging="isDragging && selectedNodeId === node.id"
            :show-connection-hints="showConnectionHints" @node-mousedown="onNodeMouseDown" @node-click="onNodeClick"
            @node-hover-side="onNodeHoverSide" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import GraphNode from './GraphNode.vue'
import GraphEdge from './GraphEdge.vue'
import ArrowDefinitions from './ArrowDefinitions.vue'
import CodeEditor from './CodeEditor.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import type { Node, Edge, ConnectionSide, EdgeGeometry } from '../types'

// Состояние
const nodes = ref<Node[]>([
  {
    id: '1',
    position: { x: 50, y: 50 },
    text: 'Начальный узел',
    width: 150,
    height: 60
  },
  {
    id: '2',
    position: { x: 300, y: 150 },
    text: 'Процесс',
    width: 120,
    height: 60
  }
])

const edges = ref<Edge[]>([
  {
    id: 'e1',
    sourceNodeId: '1',
    targetNodeId: '2',
    sourceSide: 'right',
    targetSide: 'left'
  }
])

const selectedObject = ref<{
  type: 'node' | 'edge'
  data: Node | Edge
  geometry?: EdgeGeometry
} | null>(null)

const edgeGeometries = computed(() => {
  const geometries: Record<string, EdgeGeometry> = {}
  return geometries
})

function updateNode(nodeId: string, updates: Partial<Node>): void {
  const node = nodes.value.find(n => n.id === nodeId)
  if (node) {
    Object.assign(node, updates)
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
const selectedEdgeId = ref<string | null>(null)
const isDraggingBreakpoint = ref(false)
const draggingEdgeId = ref<string | null>(null)

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

// Методы
function addNode(): void {
  const newNode: Node = {
    id: Date.now().toString(),
    position: { x: 100, y: 100 + nodes.value.length * 80 },
    text: `Узел ${nodes.value.length + 1}`,
    width: 120,
    height: 60
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
    targetSide: targetSide
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
  const startNodeX = node.position.x
  const startNodeY = node.position.y

  const tempNode = {
    id: nodeId,
    dx: 0,
    dy: 0
  }

  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!isDragging.value) return

    const deltaX = moveEvent.clientX - startMouseX
    const deltaY = moveEvent.clientY - startMouseY

    tempNode.dx = deltaX
    tempNode.dy = deltaY

    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement
    if (nodeElement) {
      nodeElement.style.setProperty('--drag-dx', `${deltaX}px`)
      nodeElement.style.setProperty('--drag-dy', `${deltaY}px`)
    }
  }

  const onMouseUp = () => {
    if (node) {
      const deltaX = tempNode.dx
      const deltaY = tempNode.dy

      node.position.x = Math.max(0, startNodeX + deltaX)
      node.position.y = Math.max(0, startNodeY + deltaY)
    }

    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement
    if (nodeElement) {
      nodeElement.style.removeProperty('--drag-dx')
      nodeElement.style.removeProperty('--drag-dy')
    }

    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
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
      edge.breakpointX = clampXValue(edge, newX)
    } else {
      const newY = moveEvent.clientY - canvasRect.top
      edge.breakpointY = clampYValue(edge, newY)
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
  background: white;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toolbar button {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.toolbar button:hover {
  background: #0056b3;
}

.toolbar button.active {
  background: #28a745;
  box-shadow: 0 0 0 2px rgba(40, 167, 69, 0.5);
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