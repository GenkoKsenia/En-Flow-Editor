<template>
  <div class="flow-editor">
    <div class="toolbar">
      <button @click="addNode">+ Добавить узел</button>
      <div class="stats">
        Узлов: {{ nodes.length }}
        <!-- Отображение узлов и связей -->
        <span v-if="edges.length">, Связей: {{ edges.length }}</span>
      </div>
    </div>
    
    <!-- снять выделение при нажатии на холст-->
    <div 
      class="canvas" 
      ref="canvas" 
      @click="deselectAll" 
    > 
      <!-- Невидимое определение стрелки -->
      <ArrowDefinitions />

      <!-- Связи -->
      <GraphEdge
        v-for="edge in edges"
        :key="edge.id"
        :edge="edge"
        :nodes="nodes"
      />

      <!-- Узлы -->
      <GraphNode
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :class="{ 
          selected: selectedNodeId === node.id, 
          dragging: isDragging && selectedNodeId === node.id 
        }"
        @node-mousedown="startDrag"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import GraphNode from './GraphNode.vue' //узлы
import GraphEdge from './GraphEdge.vue' //стрелки
import ArrowDefinitions from './ArrowDefinitions.vue' //определния стрелок
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
const canvasRect = ref<DOMRect | null>(null)

// Получаем позицию холста при загрузке
onMounted(() => {
  if (canvas.value) {
    canvasRect.value = canvas.value.getBoundingClientRect()
  }
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

function deselectAll(): void {
  selectedNodeId.value = null
}

// Перетаскивание
function startDrag(nodeId: string, event: MouseEvent): void {
  const node = nodes.value.find(n => n.id === nodeId)
  if (!node || !canvas.value) return
  
  isDragging.value = true
  selectedNodeId.value = nodeId
  
  // Обновляем позицию холста
  canvasRect.value = canvas.value.getBoundingClientRect() //получаем позицию и размеры холста относительно viewport
  
  // Вычисляем смещение относительно холста
  const offsetX = event.clientX - canvasRect.value.left - node.position.x
  const offsetY = event.clientY - canvasRect.value.top - node.position.y
  
  const onMouseMove = (moveEvent: MouseEvent) => {
    if (!canvasRect.value) return
    
    // Новая позиция относительно холста
    const newX = moveEvent.clientX - canvasRect.value.left - offsetX
    const newY = moveEvent.clientY - canvasRect.value.top - offsetY
    
    // Обновляем позицию узла
    node.position.x = Math.max(0, newX)
    node.position.y = Math.max(0, newY)
  }
  
  const onMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  
  event.preventDefault()
  event.stopPropagation()
}

</script>

<style scoped>
.flow-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
}

.toolbar {
  padding: 15px;
  background: white;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  gap: 10px;
  align-items: center;
}

.toolbar button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
}

.toolbar button:hover {
  background: #0056b3;
}

.stats {
  color: #6c757d;
  font-size: 14px;
  margin-left: auto;
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

:deep(.node.selected) {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

:deep(.node.dragging) {
  cursor: grabbing;
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
  z-index: 1000;
}
</style>