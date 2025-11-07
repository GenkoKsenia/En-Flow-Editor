<template>
  <div v-if="selectedObject" class="properties-panel">
    <div class="properties-header">
      <h3>Свойства</h3>
      <button class="close-btn" @click="clearSelection">×</button>
    </div>
    
    <div class="properties-content">
      <!-- Свойства узла -->
      <div v-if="selectedNode" class="node-properties">
        <div class="property-group">
          <h4>Узел</h4>
          <div class="property">
            <label>ID:</label>
            <span class="property-value">{{ selectedNode.id }}</span>
          </div>
          <div class="property">
            <label>Текст:</label>
            <input 
              v-model="selectedNode.text" 
              @input="onNodeTextChange"
              class="property-input"
            />
          </div>
          <div class="property">
            <label>Позиция:</label>
            <div class="position-inputs">
              <input 
                v-model.number="selectedNode.position.x" 
                @change="onNodePositionChange"
                type="number"
                class="property-input small"
              />
              <input 
                v-model.number="selectedNode.position.y" 
                @change="onNodePositionChange"
                type="number"
                class="property-input small"
              />
            </div>
          </div>
          <div class="property">
            <label>Размер:</label>
            <div class="size-inputs">
              <input 
                v-model.number="selectedNode.width" 
                @change="onNodeSizeChange"
                type="number"
                class="property-input small"
              />
              <input 
                v-model.number="selectedNode.height" 
                @change="onNodeSizeChange"
                type="number"
                class="property-input small"
              />
            </div>
          </div>
        </div>
      </div>
      
      <!-- Свойства стрелки -->
      <div v-else-if="selectedEdge" class="edge-properties">
        <div class="property-group">
          <h4>Связь</h4>
          <div class="property">
            <label>ID:</label>
            <span class="property-value">{{ selectedEdge.id }}</span>
          </div>

          
          <!-- Точки излома для 3-сегментных стрелок -->
          <div v-if="hasBreakpoint(selectedEdge)" class="property-group">
            <h5>Точки излома</h5>
            <div class="property" v-if="selectedEdge.breakpointX !== undefined">
              <label>Позиция X:</label>
              <input 
                v-model.number="selectedEdge.breakpointX" 
                @change="onEdgeBreakpointChange"
                type="number"
                class="property-input"
              />
            </div>
            <div class="property" v-if="selectedEdge.breakpointY !== undefined">
              <label>Позиция Y:</label>
              <input 
                v-model.number="selectedEdge.breakpointY" 
                @change="onEdgeBreakpointChange"
                type="number"
                class="property-input"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Кнопка удаления -->
    <div class="properties-actions">
      <button class="delete-btn" @click="deleteSelectedObject">
        Удалить
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Node, Edge, EdgeGeometry } from '../types'

interface SelectedObject {
  type: 'node' | 'edge'
  data: Node | Edge
  geometry?: EdgeGeometry
}

interface Props {
  selectedObject?: SelectedObject | null
}

interface Emits {
  (e: 'update:node', nodeId: string, updates: Partial<Node>): void
  (e: 'update:edge', edgeId: string, updates: Partial<Edge>): void
  (e: 'delete:node', nodeId: string): void
  (e: 'delete:edge', edgeId: string): void
  (e: 'clear-selection'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Computed свойства для безопасного доступа к данным
const selectedNode = computed(() => {
  return props.selectedObject?.type === 'node' ? props.selectedObject.data as Node : null
})

const selectedEdge = computed(() => {
  return props.selectedObject?.type === 'edge' ? props.selectedObject.data as Edge : null
})

// Определяем тип стрелки
function getEdgeType(edge: Edge): string {
  const { sourceSide, targetSide } = edge
  
  if (sourceSide === targetSide) {
    return `Одинаковые стороны (${sourceSide}-${targetSide})`
  } else if (
    (sourceSide === 'left' && targetSide === 'right') ||
    (sourceSide === 'right' && targetSide === 'left') ||
    (sourceSide === 'top' && targetSide === 'bottom') ||
    (sourceSide === 'bottom' && targetSide === 'top')
  ) {
    return `Противоположные стороны (${sourceSide}-${targetSide})`
  } else {
    return `Смежные стороны (${sourceSide}-${targetSide})`
  }
}

// Проверяем, есть ли у стрелки точки излома
function hasBreakpoint(edge: Edge): boolean {
  return edge.breakpointX !== undefined || edge.breakpointY !== undefined
}

// Обработчики изменений
function onNodeTextChange(): void {
  if (selectedNode.value) {
    emit('update:node', selectedNode.value.id, {
      text: selectedNode.value.text
    })
  }
}

function onNodePositionChange(): void {
  if (selectedNode.value) {
    emit('update:node', selectedNode.value.id, {
      position: { ...selectedNode.value.position }
    })
  }
}

function onNodeSizeChange(): void {
  if (selectedNode.value) {
    emit('update:node', selectedNode.value.id, {
      width: selectedNode.value.width,
      height: selectedNode.value.height
    })
  }
}

function onEdgeBreakpointChange(): void {
  if (selectedEdge.value) {
    emit('update:edge', selectedEdge.value.id, {
      breakpointX: selectedEdge.value.breakpointX,
      breakpointY: selectedEdge.value.breakpointY
    })
  }
}

function deleteSelectedObject(): void {
  if (!props.selectedObject) return
  
  if (props.selectedObject.type === 'node') {
    emit('delete:node', props.selectedObject.data.id)
  } else {
    emit('delete:edge', props.selectedObject.data.id)
  }
}

function clearSelection(): void {
  emit('clear-selection')
}
</script>

<style scoped>
.properties-panel {
  position: absolute;
  top: 120px;
  right: 10px;
  width: 300px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  max-height: 80vh;
  overflow-y: auto;
}

.properties-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.properties-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #6c757d;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #dc3545;
}

.properties-content {
  padding: 16px;
}

.property-group {
  margin-bottom: 20px;
}

.property-group h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #495057;
}

.property-group h5 {
  margin: 16px 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #6c757d;
}

.property {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.property label {
  font-size: 13px;
  color: #495057;
  font-weight: 500;
  min-width: 80px;
}

.property-value {
  font-size: 13px;
  color: #6c757d;
  text-align: right;
}

.property-input {
  padding: 6px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  width: 120px;
}

.property-input.small {
  width: 60px;
}

.position-inputs,
.size-inputs {
  display: flex;
  gap: 8px;
}

.properties-actions {
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.delete-btn {
  width: 100%;
  padding: 8px 16px;
  background: #ffffff;
  color: #dc3545;
  border: solid;
  border-color: #dc3545;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.delete-btn:hover {
  background: #c82333;
  border-color: #c82333;
  color: #ffffff;
}
</style>