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
          <div class="property">
            <label>Конечный блок данных:</label>
            <select 
              class="property-input"
              :value="selectedNode.dataTargetId || ''"
              @change="onNodeDataTargetChange"
            >
              <option value="">— не выбран —</option>
              <option :value="selectedNode.id">Этот блок (конечный)</option>
              <option 
                v-for="option in dataTargetsOptions" 
                :key="option.value" 
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="property">
            <label>Стиль рамки:</label>
            <select 
              class="property-input"
              :value="selectedNode.borderStyle || 'solid'"
              @change="onNodeBorderStyleChange"
            >
              <option 
                v-for="option in nodeLineStyleOptions" 
                :key="option.value" 
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="property">
            <label>Цвет блока:</label>
            <input 
              type="color"
              class="property-input small"
              :value="selectedNode.color || '#ffffff'"
              @input="onNodeColorChange"
            />
          </div>
          <div class="property">
            <label>Цвет рамки:</label>
            <input 
              type="color"
              class="property-input small"
              :value="selectedNode.borderColor || '#666666'"
              @input="onNodeBorderColorChange"
            />
          </div>
          <div class="property">
            <label>Толщина рамки:</label>
            <input 
              v-model.number="selectedNode.borderWidth" 
              @change="onNodeBorderWidthChange"
              type="number"
              class="property-input small"
              min="0"
            />
          </div>
          <div class="property">
            <label>Скругление:</label>
            <input 
              v-model.number="selectedNode.borderRadius" 
              @change="onNodeBorderRadiusChange"
              type="number"
              class="property-input small"
              min="0"
            />
          </div>
          <div class="property-group">
            <h5>Стрелки, проходящие через блок</h5>
            <details class="edge-selector">
              <summary>Выбрать стрелки</summary>
              <div class="edge-checkboxes">
                <label 
                  v-for="edge in availableEdges" 
                  :key="edge.id" 
                  class="edge-option"
                >
                  <input 
                    type="checkbox" 
                    :value="edge.id" 
                    :checked="isEdgeRequired(edge.id)"
                    @change="onPassThroughEdgeInput(edge.id, $event)"
                  />
                  {{ formatEdgeLabel(edge) }}
                </label>
              </div>
            </details>
          </div>
        </div>
      </div>
      
      <!-- Свойства стрелки -->
      <div v-else-if="selectedEdge" class="edge-properties">
        <div class="property-group">
          <h4>Связь</h4>
          <div class="property">
            <label>Название:</label>
            <input 
              v-model="selectedEdge.label"
              @input="onEdgeLabelChange"
              class="property-input"
              placeholder="Название связи"
            />
          </div>
          <div class="property">
            <label>Стиль линии:</label>
            <select 
              class="property-input"
              :value="selectedEdge.lineStyle || 'solid'"
              @change="onEdgeLineStyleChange"
            >
              <option 
                v-for="option in edgeLineStyleOptions" 
                :key="option.value" 
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </div>
          <div class="property">
            <label>Цвет линии:</label>
            <input 
              type="color"
              class="property-input small"
              :value="selectedEdge.color || '#666666'"
              @input="onEdgeColorChange"
            />
          </div>
          <div class="property">
            <label>Толщина линии:</label>
            <input 
              v-model.number="selectedEdge.width"
              @change="onEdgeWidthChange"
              type="number"
              class="property-input small"
              min="0"
            />
          </div>

          <div class="property-group">
            <h5>Данные, которые переносит эта связь</h5>
            <div class="edge-checkboxes">
              <label 
                v-for="option in edgeDataOptions" 
                :key="option.value" 
                class="edge-option"
              >
                <input 
                  type="checkbox" 
                  :value="option.value" 
                  :checked="edgeCarries(option.value)"
                  :disabled="option.locked"
                  @change="onEdgeDataKeyToggle(option.value, $event)"
                />
                {{ option.label }}
                <span v-if="option.locked" class="hint">(обязательно)</span>
              </label>
              <div v-if="!edgeDataOptions.length" class="hint">Нет доступных данных для этой стрелки</div>
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
import type { Node, Edge, EdgeGeometry, LineStyle } from '../types'

interface SelectedObject {
  type: 'node' | 'edge'
  data: Node | Edge
  geometry?: EdgeGeometry
}

interface Props {
  selectedObject?: SelectedObject | null
  edges?: Edge[]
  nodes?: Node[]
  dataSets?: Record<string, string[]>
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

const availableEdges = computed(() => props.edges ?? [])
const availableNodes = computed(() => props.nodes ?? [])
const nodeLineStyleOptions: { value: LineStyle, label: string }[] = [
  { value: 'solid', label: 'Сплошная' },
  { value: 'dashed', label: 'Пунктирная' }
]
const edgeLineStyleOptions: { value: LineStyle, label: string }[] = [
  { value: 'solid', label: 'Сплошная' },
  { value: 'dashed', label: 'Пунктирная' },
  { value: 'dotted', label: 'Пунктир с точкой' }
]

const dataTargetsOptions = computed(() => {
  return availableNodes.value
    .filter(node => !selectedNode.value || node.id !== selectedNode.value.id) // исключаем сам блок
    .map(node => ({ value: node.id, label: node.text || node.id }))
})

function formatEdgeLabel(edge: Edge): string {
  return edge.label?.trim() || edge.id
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

function onNodeBorderStyleChange(event: Event): void {
  if (!selectedNode.value) return
  const value = (event.target as HTMLSelectElement).value as LineStyle
  const safeValue: LineStyle = value === 'dotted' ? 'dashed' : value
  selectedNode.value.borderStyle = safeValue
  emit('update:node', selectedNode.value.id, {
    borderStyle: safeValue
  })
}

function onNodeColorChange(event: Event): void {
  if (!selectedNode.value) return
  const value = (event.target as HTMLInputElement).value
  selectedNode.value.color = value
  emit('update:node', selectedNode.value.id, { color: value })
}

function onNodeBorderColorChange(event: Event): void {
  if (!selectedNode.value) return
  const value = (event.target as HTMLInputElement).value
  selectedNode.value.borderColor = value
  emit('update:node', selectedNode.value.id, { borderColor: value })
}

function onNodeBorderWidthChange(): void {
  if (!selectedNode.value) return
  emit('update:node', selectedNode.value.id, { borderWidth: selectedNode.value.borderWidth })
}

function onNodeBorderRadiusChange(): void {
  if (!selectedNode.value) return
  emit('update:node', selectedNode.value.id, { borderRadius: selectedNode.value.borderRadius })
}

function onNodeDataTargetChange(event: Event): void {
  if (!selectedNode.value) return
  const value = (event.target as HTMLSelectElement).value
  const target = value === '' ? null : value
  selectedNode.value.dataTargetId = target
  selectedNode.value.dataTargetSetManually = true
  emit('update:node', selectedNode.value.id, { dataTargetId: target, dataTargetSetManually: true })
}

function onPassThroughEdgeInput(edgeId: string, event: Event): void {
  const target = event.target as HTMLInputElement
  onPassThroughEdgeToggle(edgeId, target.checked)
}

function isEdgeRequired(edgeId: string): boolean {
  return selectedNode.value?.passThroughEdges?.includes(edgeId) ?? false
}

function onPassThroughEdgeToggle(edgeId: string, checked: boolean): void {
  if (!selectedNode.value) return
  const current = [...(selectedNode.value.passThroughEdges || [])]
  const index = current.indexOf(edgeId)
  
  if (checked && index === -1) {
    current.push(edgeId)
  } else if (!checked && index !== -1) {
    current.splice(index, 1)
  }
  
  selectedNode.value.passThroughEdges = current
  emit('update:node', selectedNode.value.id, {
    passThroughEdges: current
  })
}

function onEdgeLabelChange(): void {
  if (!selectedEdge.value) return
  emit('update:edge', selectedEdge.value.id, {
    label: selectedEdge.value.label
  })
}

function onEdgeLineStyleChange(event: Event): void {
  if (!selectedEdge.value) return
  const value = (event.target as HTMLSelectElement).value as LineStyle
  selectedEdge.value.lineStyle = value
  emit('update:edge', selectedEdge.value.id, {
    lineStyle: value
  })
}

function onEdgeColorChange(event: Event): void {
  if (!selectedEdge.value) return
  const value = (event.target as HTMLInputElement).value
  selectedEdge.value.color = value
  emit('update:edge', selectedEdge.value.id, { color: value })
}

function onEdgeWidthChange(): void {
  if (!selectedEdge.value) return
  emit('update:edge', selectedEdge.value.id, { width: selectedEdge.value.width })
}

function onEdgeDataKeyToggle(nodeId: string, event: Event): void {
  if (!selectedEdge.value) return
  // Собственные данные связи не разрешаем снимать
  if (nodeId === selectedEdge.value.sourceNodeId) return
  const checked = (event.target as HTMLInputElement).checked
  const current = [...(selectedEdge.value.dataKeys ?? [])]
  const idx = current.indexOf(nodeId)
  if (checked && idx === -1) {
    current.push(nodeId)
  } else if (!checked && idx !== -1) {
    current.splice(idx, 1)
  }
  // ограничиваем данными исходного блока
  const allowed = edgeDataOptions.value.map(o => o.value)
  const sanitized = current.filter(id => allowed.includes(id))
  selectedEdge.value.dataKeys = sanitized
  emit('update:edge', selectedEdge.value.id, { dataKeys: sanitized })
}

function edgeCarries(nodeId: string): boolean {
  return selectedEdge.value?.dataKeys?.includes(nodeId) ?? false
}

const edgeDataOptions = computed(() => {
  const edge = selectedEdge.value
  if (!edge) return []
  const dataset = props.dataSets?.[edge.sourceNodeId] ?? []
  return dataset.map(id => ({
    value: id,
    label: resolveDataLabel(id, edge),
    locked: id === edge.sourceNodeId // собственные данные всегда обязательны
  }))
})

function resolveDataLabel(dataId: string, edge: Edge): string {
  // Пытаемся найти входящую стрелку, которая принесла эти данные в исходный узел
  const incomingEdge = availableEdges.value.find(
    e => e.targetNodeId === edge.sourceNodeId && (e.dataKeys ?? []).includes(dataId)
  )

  if (incomingEdge) {
    return incomingEdge.label?.trim() || incomingEdge.id
  }

  // Если данных не приносили, считаем, что стрелка переносит собственные данные
  return edge.label?.trim() || edge.id
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

.edge-selector {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 8px 12px;
}

.edge-selector summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #495057;
}

.edge-checkboxes {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.edge-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #495057;
}
</style>
