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


        <!-- снять выделение при нажатии на холст-->
        <div class="canvas" ref="canvas" @click="onCanvasClick">

          <!-- Невидимое определение стрелки -->
          <ArrowDefinitions />

          <!-- Постоянные связи -->
          <GraphEdge v-for="edge in edges" :key="edge.id" :edge="edge" :nodes="nodes"
            :source-connections-count="outgoingConnectionsCount[edge.sourceNodeId] || 0"
            :source-connection-index="outgoingConnectionIndex[edge.id] || 0"
            :target-connections-count="incomingConnectionsCount[edge.targetNodeId] || 0"
            :target-connection-index="incomingConnectionIndex[edge.id] || 0" />

          <!-- Узлы -->
          <GraphNode v-for="node in nodes" :key="node.id" :node="node" :data-node-id="node.id"
            :selected="selectedNodeId === node.id" :is-connection-source="isConnectionSource(node.id)"
            :is-connection-target="isConnectionTarget(node.id)" :is-dragging="isDragging && selectedNodeId === node.id"
            @node-mousedown="onNodeMouseDown" @node-click="onNodeClick" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import GraphNode from './GraphNode.vue' //узлы
import GraphEdge from './GraphEdge.vue' //стрелки
import ArrowDefinitions from './ArrowDefinitions.vue' //определния стрелок
import CodeEditor from './CodeEditor.vue' //окно для кода
import type { Node } from '../types'
import type { Edge } from '../types'


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
    sourceNodeId: '1',  // От узла с id '1'
    targetNodeId: '2'   // К узлу с id '2'
  }
])

const selectedNodeId = ref<string | null>(null)
const isDragging = ref(false)
const canvas = ref<HTMLElement | null>(null)

// Состояние для режима соединения
const isConnectionMode = ref(false)
const connectionStartNode = ref<string | null>(null)

// Computed свойства для состояний узлов
const isConnectionSource = computed(() => (nodeId: string) => {
  return isConnectionMode.value && connectionStartNode.value === nodeId
})

const isConnectionTarget = computed(() => (nodeId: string) => {
  return isConnectionMode.value && !!connectionStartNode.value && connectionStartNode.value !== nodeId
})

// Получаем позицию холста при загрузке
onMounted(() => {

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
}

// Обработчик клика по узлу в режиме соединения
function handleNodeClickInConnectionMode(nodeId: string): void {
  if (!connectionStartNode.value) {
    // Первый клик - выбираем начальный узел
    connectionStartNode.value = nodeId
    console.log('Выбран начальный узел:', nodeId)
  } else {
    // Второй клик - создаем связь
    if (connectionStartNode.value !== nodeId) {
      createConnection(connectionStartNode.value, nodeId)
    }
    resetConnectionMode()
  }
}
// Создание связи между узлами
function createConnection(sourceId: string, targetId: string): void {
  // Проверяем, что связь не существует
  const existingEdge = edges.value.find(
    edge => edge.sourceNodeId === sourceId && edge.targetNodeId === targetId
  )

  if (existingEdge) {
    console.log('Связь уже существует')
    return
  }

  // Создаем новую связь
  const newEdge: Edge = {
    id: `edge-${Date.now()}`,
    sourceNodeId: sourceId,
    targetNodeId: targetId
  }

  edges.value.push(newEdge)
}

// Сбрасываем режим при клике на холст
function deselectAll(): void {
  selectedNodeId.value = null
  if (isConnectionMode.value) {
    isConnectionMode.value = false
    connectionStartNode.value = null
  }
}

// Обработчик клика по холсту
function onCanvasClick(event: MouseEvent): void {
  // Если клик по пустому месту в режиме соединения - сбрасываем режим
  if (isConnectionMode.value && !(event.target as Element).closest('.node')) {
    resetConnectionMode()
  } else {
    deselectAll() // Обычный режим
  }
}

// Сброс режима соединения
function resetConnectionMode(): void {
  isConnectionMode.value = false
  connectionStartNode.value = null
}

function selectNode(nodeId: string): void {
  selectedNodeId.value = nodeId
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
  const node = nodes.value.find(n => n.id === nodeId)
  if (!node) return

  isDragging.value = true
  selectedNodeId.value = nodeId

  // Фиксируем начальные позиции
  const startMouseX = event.clientX
  const startMouseY = event.clientY
  const startNodeX = node.position.x
  const startNodeY = node.position.y

  // Создаем временный элемент для отслеживания позиции
  const tempNode = {
    id: nodeId,
    dx: 0,
    dy: 0
  }

  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!isDragging.value) return

    // Вычисляем смещение
    const deltaX = moveEvent.clientX - startMouseX
    const deltaY = moveEvent.clientY - startMouseY

    // Обновляем CSS переменные для transform
    tempNode.dx = deltaX
    tempNode.dy = deltaY

    // Находим DOM элемент и применяем transform
    const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement
    if (nodeElement) {
      nodeElement.style.setProperty('--drag-dx', `${deltaX}px`)
      nodeElement.style.setProperty('--drag-dy', `${deltaY}px`)
    }
  }

  const onMouseUp = () => {
    // Применяем окончательную позицию
    if (node) {
      const deltaX = tempNode.dx
      const deltaY = tempNode.dy

      node.position.x = Math.max(0, startNodeX + deltaX)
      node.position.y = Math.max(0, startNodeY + deltaY)
    }

    // Сбрасываем transform
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

// Обработчик начала перетаскивания - блокируем в режиме соединения
function onNodeMouseDown(nodeId: string, event: MouseEvent): void {
  if (isConnectionMode.value) {
    event.preventDefault() // Блокируем перетаскивание в режиме соединения
    return
  }

  startDrag(nodeId, event) // Обычное перетаскивание
}

// Вычисляем количество исходящих соединений для каждого узла
const outgoingConnectionsCount = computed(() => {
  const count: Record<string, number> = {}
  nodes.value.forEach(node => count[node.id] = 0)
  edges.value.forEach(edge => {
    count[edge.sourceNodeId] = (count[edge.sourceNodeId] || 0) + 1
  })
  return count
})

// Вычисляем количество входящих соединений для каждого узла
const incomingConnectionsCount = computed(() => {
  const count: Record<string, number> = {}
  nodes.value.forEach(node => count[node.id] = 0)
  edges.value.forEach(edge => {
    count[edge.targetNodeId] = (count[edge.targetNodeId] || 0) + 1
  })
  return count
})

// Вычисляем индекс каждого соединения среди исходящих
const outgoingConnectionIndex = computed(() => {
  const index: Record<string, number> = {}
  const seen: Record<string, number> = {}

  nodes.value.forEach(node => seen[node.id] = 0)

  // Сортируем edges для consistent порядка
  const sortedEdges = [...edges.value].sort((a, b) => a.id.localeCompare(b.id))

  sortedEdges.forEach(edge => {
    index[edge.id] = seen[edge.sourceNodeId]
    seen[edge.sourceNodeId]++
  })

  return index
})

// Вычисляем индекс каждого соединения среди входящих
const incomingConnectionIndex = computed(() => {
  const index: Record<string, number> = {}
  const seen: Record<string, number> = {}

  nodes.value.forEach(node => seen[node.id] = 0)

  // Сортируем edges для consistent порядка
  const sortedEdges = [...edges.value].sort((a, b) => a.id.localeCompare(b.id))

  sortedEdges.forEach(edge => {
    index[edge.id] = seen[edge.targetNodeId]
    seen[edge.targetNodeId]++
  })

  return index
})
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