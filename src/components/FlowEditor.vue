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
          <button @click="addNode">+ Добавить узел</button>
          <div class="stats">
            Узлов: {{ nodes.length }}
            <span v-if="edges.length">, Связей: {{ edges.length }}</span>
          </div>
        </div>


        <!-- снять выделение при нажатии на холст-->
        <div class="canvas" ref="canvas" @click="deselectAll">

          <!-- Невидимое определение стрелки -->
          <ArrowDefinitions />

          <!-- Связи -->
          <GraphEdge v-for="edge in edges" :key="edge.id" :edge="edge" :nodes="nodes" />

          <!-- Узлы -->
          <GraphNode v-for="node in nodes" :key="node.id" :node="node" :class="{
            selected: selectedNodeId === node.id,
            dragging: isDragging && selectedNodeId === node.id
          }" @node-mousedown="startDrag" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
  justify-content: space-between; /* ← ключевое свойство */
  align-items: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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