<template>
  <div v-if="selectedObject" class="properties-panel">
    <div class="properties-header">
      <h3>Свойства</h3>
      <button class="close-btn" @click="clearSelection">×</button>
    </div>

    <div v-if="lockMessage" class="lock-banner">
      {{ lockMessage }}
    </div>

    <fieldset class="properties-fieldset" :disabled="isLocked">
      <div class="properties-content">
      <!-- Свойства узла -->
      <div v-if="selectedNode" class="node-properties">
        <div class="property-group">
          <h4>Узел</h4>
          <div class="property">
            <label>Текст:</label>
            <UiInput
              v-model="selectedNode.text" 
              @change="onNodeTextChange"
              class="property-input"
            />
          </div>
          <div class="property">
            <label>Позиция:</label>
            <div class="position-inputs">
              <UiInput
                v-model="selectedNode.position.x"
                @change="onNodePositionChange"
                type="number"
                size="sm"
                class="property-input small"
              />
              <UiInput
                v-model="selectedNode.position.y"
                @change="onNodePositionChange"
                type="number"
                size="sm"
                class="property-input small"
              />
            </div>
          </div>
          <div class="property">
            <label>Размер:</label>
            <div class="size-inputs">
              <UiInput
                v-model="selectedNode.width"
                @change="onNodeSizeChange"
                type="number"
                size="sm"
                class="property-input small"
              />
              <UiInput
                v-model="selectedNode.height"
                @change="onNodeSizeChange"
                type="number"
                size="sm"
                class="property-input small"
              />
            </div>
          </div>
          <div class="property-group">
            <div class="property header-row">
              <label>Данные блока</label>
              <UiButton class="add-data-btn" size="sm" variant="neutral" @click="onAddDataItem">＋</UiButton>
            </div>
            <div v-if="blockDataItems.length" class="data-list">
              <div v-for="item in blockDataItems" :key="item.dataKey" class="data-row">
                <div class="data-row-line">
                  <label>Название:</label>
                  <UiInput
                    class="property-input"
                    :model-value="item.dataName"
                    size="sm"
                    @update:model-value="value => onDataNameChange(item.dataKey, String(value))"
                  />
                </div>
                <div class="data-row-line">
                  <label>Конечные блоки:</label>
                  <details class="checkbox-dropdown">
                    <summary>{{ finishLabel(item.finishBlocks ?? []) }}</summary>
                    <div class="checkbox-list">
                      <label 
                        v-for="opt in finishOptions" 
                        :key="opt.value" 
                        class="checkbox-option"
                      >
                        <input 
                          type="checkbox" 
                          :value="opt.value" 
                          :checked="(item.finishBlocks ?? []).includes(opt.value)"
                          :disabled="opt.value === selectedNode.id"
                          @change="e => onToggleFinish(item.dataKey, opt.value, (e.target as HTMLInputElement).checked)"
                        />
                        {{ opt.label }}
                      </label>
                    </div>
                  </details>
                </div>
                <div class="data-row-actions">
                  <UiButton size="sm" variant="danger-outline" @click="onRemoveDataItem(item.dataKey)">Удалить</UiButton>
                </div>
              </div>
            </div>
            <div v-else></div>
          </div>
          <div class="property">
            <label>Стиль рамки:</label>
            <UiSelect
              class="property-input"
              :model-value="selectedNode.borderStyle || 'solid'"
              size="sm"
              @update:model-value="onNodeBorderStyleChange"
            >
              <option 
                v-for="option in nodeLineStyleOptions" 
                :key="option.value" 
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </UiSelect>
          </div>
          <div class="property">
            <label>Цвет блока:</label>
            <UiInput
              type="color"
              size="sm"
              class="property-input small"
              :model-value="selectedNode.color || '#ffffff'"
              @update:model-value="value => onNodeColorChange(String(value))"
            />
          </div>
          <div class="property">
            <label>Цвет рамки:</label>
            <UiInput
              type="color"
              size="sm"
              class="property-input small"
              :model-value="selectedNode.borderColor || '#666666'"
              @update:model-value="value => onNodeBorderColorChange(String(value))"
            />
          </div>
          <div class="property">
            <label>Толщина рамки:</label>
            <UiInput
              v-model="selectedNode.borderWidth"
              @change="onNodeBorderWidthChange"
              type="number"
              size="sm"
              class="property-input small"
              min="0"
            />
          </div>
          <div class="property">
            <label>Скругление:</label>
            <UiInput
              v-model="selectedNode.borderRadius"
              @change="onNodeBorderRadiusChange"
              type="number"
              size="sm"
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
            <UiInput
              v-model="selectedEdge.label"
              @change="onEdgeLabelChange"
              class="property-input"
              placeholder="Название связи"
            />
          </div>
          <div class="property">
            <label>Стиль линии:</label>
            <UiSelect
              class="property-input"
              :model-value="selectedEdge.lineStyle || 'solid'"
              size="sm"
              @update:model-value="onEdgeLineStyleChange"
            >
              <option 
                v-for="option in edgeLineStyleOptions" 
                :key="option.value" 
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </UiSelect>
          </div>
          <div class="property">
            <label>Цвет линии:</label>
            <UiInput
              type="color"
              size="sm"
              class="property-input small"
              :model-value="selectedEdge.color || '#666666'"
              @update:model-value="value => onEdgeColorChange(String(value))"
            />
          </div>
          <div class="property">
            <label>Толщина линии:</label>
            <UiInput
              v-model="selectedEdge.width"
              @change="onEdgeWidthChange"
              type="number"
              size="sm"
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
        <UiButton block variant="danger-outline" @click="deleteSelectedObject">
          Удалить
        </UiButton>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UiButton from '@/presentation/ui/UiButton.vue'
import UiInput from '@/presentation/ui/UiInput.vue'
import UiSelect from '@/presentation/ui/UiSelect.vue'
import type { SelectedObject } from '@/domains/diagram'
import type { DataFlow, Edge, LineStyle, Node } from '@/domains/graph'

interface Props {
  selectedObject?: SelectedObject | null
  edges?: Edge[]
  nodes?: Node[]
  dataSets?: Record<string, string[]>
  dataFlows?: DataFlow[]
  isLocked?: boolean
  lockMessage?: string | null
}

interface Emits {
  (e: 'update:node', nodeId: string, updates: Partial<Node>): void
  (e: 'update:edge', edgeId: string, updates: Partial<Edge>): void
  (e: 'delete:node', nodeId: string): void
  (e: 'delete:edge', edgeId: string): void
  (e: 'clear-selection'): void
  (e: 'update:dataFlows', flows: DataFlow[]): void
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
const nodeLineStyleOptions: { value: LineStyle, label: string }[] = [
  { value: 'solid', label: 'Сплошная' },
  { value: 'dashed', label: 'Пунктирная' }
]
const edgeLineStyleOptions: { value: LineStyle, label: string }[] = [
  { value: 'solid', label: 'Сплошная' },
  { value: 'dashed', label: 'Пунктирная' },
  { value: 'dotted', label: 'Пунктир с точкой' }
]

const dataFlowMap = computed(() => {
  const map = new Map<string, DataFlow>()
  ;(props.dataFlows ?? []).forEach(flow => map.set(flow.dataKey, flow))
  return map
})

const blockDataItems = computed(() => {
  if (!selectedNode.value) return []
  return (props.dataFlows ?? []).filter(flow => flow.startBlock === selectedNode.value!.id)
})

const finishOptions = computed(() => {
  if (!props.nodes) return []
  return props.nodes.map(n => ({ value: n.id, label: n.text || n.id }))
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

function onNodeBorderStyleChange(value: string): void {
  if (!selectedNode.value) return
  const safeValue: LineStyle = value === 'dotted' ? 'dashed' : value
  selectedNode.value.borderStyle = safeValue
  emit('update:node', selectedNode.value.id, {
    borderStyle: safeValue
  })
}

function onNodeColorChange(value: string): void {
  if (!selectedNode.value) return
  selectedNode.value.color = value
  emit('update:node', selectedNode.value.id, { color: value })
}

function onNodeBorderColorChange(value: string): void {
  if (!selectedNode.value) return
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

function collectSelected(event: Event): string[] {
  const select = event.target as HTMLSelectElement
  return Array.from(select.selectedOptions).map(o => o.value)
}

function syncInformationIds(nodeId: string, flows: DataFlow[]): void {
  const ids = flows.filter(f => f.startBlock === nodeId).map(f => f.dataKey)
  emit('update:node', nodeId, { informationIds: ids })
}

function onAddDataItem(): void {
  if (!selectedNode.value) return
  const newId = Date.now().toString()
  const flows = [...(props.dataFlows ?? []), {
    dataKey: newId,
    dataName: `Данные ${blockDataItems.value.length + 1}`,
    startBlock: selectedNode.value.id,
    finishBlocks: []
  } satisfies DataFlow]
  emit('update:dataFlows', flows)
  syncInformationIds(selectedNode.value.id, flows)
}

function onDataNameChange(dataKey: string, value: string): void {
  if (!props.dataFlows) return
  const flow = props.dataFlows.find(item => item.dataKey === dataKey)
  if (flow) {
    flow.dataName = value
  }
  const flows = props.dataFlows.map(f => f.dataKey === dataKey ? { ...f, dataName: value } : f)
  emit('update:dataFlows', flows)
}

function onDataFinishChange(dataKey: string, finishes: string[]): void {
  if (!props.dataFlows) return
  const flows = props.dataFlows.map(f => f.dataKey === dataKey ? { ...f, finishBlocks: finishes } : f)
  emit('update:dataFlows', flows)
}

function onRemoveDataItem(dataKey: string): void {
  if (!props.dataFlows || !selectedNode.value) return
  const flows = props.dataFlows.filter(f => f.dataKey !== dataKey)
  emit('update:dataFlows', flows)
  syncInformationIds(selectedNode.value.id, flows)
}

function finishLabel(selected: string[]): string {
  if (!selected.length) return 'Не выбрано'
  const labels = selected
    .map(id => finishOptions.value.find(o => o.value === id)?.label ?? id)
  return labels.join(', ')
}

function onToggleFinish(dataKey: string, value: string, checked: boolean): void {
  if (!props.dataFlows) return
  const flows = props.dataFlows.map(f => {
    if (f.dataKey !== dataKey) return f
    const set = new Set(f.finishBlocks ?? [])
    if (checked) {
      set.add(value)
    } else {
      set.delete(value)
    }
    return { ...f, finishBlocks: Array.from(set) }
  })
  emit('update:dataFlows', flows)
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

function onEdgeLineStyleChange(value: string): void {
  if (!selectedEdge.value) return
  const nextValue = value as LineStyle
  selectedEdge.value.lineStyle = nextValue
  emit('update:edge', selectedEdge.value.id, {
    lineStyle: nextValue
  })
}

function onEdgeColorChange(value: string): void {
  if (!selectedEdge.value) return
  selectedEdge.value.color = value
  emit('update:edge', selectedEdge.value.id, { color: value })
}

function onEdgeWidthChange(): void {
  if (!selectedEdge.value) return
  emit('update:edge', selectedEdge.value.id, { width: selectedEdge.value.width })
}

function onEdgeDataKeyToggle(nodeId: string, event: Event): void {
  if (!selectedEdge.value) return
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
    locked: false
  }))
})

function resolveDataLabel(dataId: string, edge: Edge): string {
  const flow = dataFlowMap.value.get(dataId)
  if (flow) {
    return flow.dataName || flow.dataKey
  }
  // Пытаемся найти входящую стрелку, которая принесла эти данные в исходный узел
  const incomingEdge = availableEdges.value.find(
    e => e.targetNodeId === edge.sourceNodeId && (e.dataKeys ?? []).includes(dataId)
  )

  if (incomingEdge) {
    return incomingEdge.label?.trim() || incomingEdge.id
  }

  // Если данных не приносили, показываем id
  return dataId
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

.properties-fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
}

.lock-banner {
  padding: 10px 16px;
  background: #fff4e5;
  color: #8a4b00;
  font-size: 13px;
  border-bottom: 1px solid #f0d3a6;
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
  width: 128px;
}

.property-input.small {
  width: 60px;
}

.data-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.data-row {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 8px;
  background: #fafafa;
}

.data-row-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.data-row-line label {
  min-width: 110px;
  color: #495057;
  font-size: 13px;
  font-weight: 500;
}

.data-row-line .property-input {
  width: 115px;
  max-width: 115px;
  flex: 0 0 auto;
}

.data-row-actions {
  display: flex;
  justify-content: flex-end;
}

.checkbox-dropdown {
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: #fff;
  padding: 6px 8px;
  width: 115px;
  max-width: 150px;
  flex: 0 0 auto;
}

.checkbox-dropdown summary {
  cursor: pointer;
  list-style: none;
  font-size: 13px;
  color: #333;
}

.checkbox-dropdown summary::-webkit-details-marker {
  display: none;
}

.checkbox-list {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.add-data-btn {
  width: 32px;
  min-width: 32px;
  padding: 0;
  font-size: 16px;
}

.property-input.multiline {
  width: 100%;
  min-height: 72px;
  resize: vertical;
}

.info-list {
  list-style: none;
  padding-left: 0;
  margin: 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
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
