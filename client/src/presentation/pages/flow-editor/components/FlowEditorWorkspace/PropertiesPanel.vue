<template>
  <div v-if="panelMode !== 'none' && panelMode !== 'mixed'" class="properties-panel">
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
      <div v-if="isNodePanel" class="node-properties">
        <div class="property-group">
          <h4>Узел</h4>
          <div class="property">
            <label>Текст:</label>
            <UiInput
              v-model="nodeTextValue"
              @change="applyNodeText"
              class="property-input"
            />
          </div>
          <div class="property property--stacked">
            <label>Информация:</label>
            <textarea
              v-model="nodeInformationTextValue"
              class="property-input multiline"
              placeholder="Дополнительный текст"
              @change="applyNodeInformationText"
            ></textarea>
          </div>
          <div class="property">
            <label>Позиция:</label>
            <div class="position-inputs">
              <UiInput
                v-model="nodePositionXValue"
                @change="applyNodePositionX"
                type="number"
                size="sm"
                class="property-input small"
              />
              <UiInput
                v-model="nodePositionYValue"
                @change="applyNodePositionY"
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
                v-model="nodeWidthValue"
                @change="applyNodeWidth"
                type="number"
                size="sm"
                class="property-input small"
              />
              <UiInput
                v-model="nodeHeightValue"
                @change="applyNodeHeight"
                type="number"
                size="sm"
                class="property-input small"
              />
            </div>
          </div>
          <div v-if="isSingleNodeSelection" class="property-group">
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
                          :disabled="opt.value === singleSelectedNode?.id"
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
              :model-value="nodeBorderStyleValue"
              size="sm"
              @update:model-value="onNodeBorderStyleChange"
            >
              <option value="" disabled></option>
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
              v-model="nodeColorValue"
              :type="nodeColorInputType"
              size="sm"
              class="property-input small"
              @change="applyNodeColor"
            />
          </div>
          <div class="property">
            <label>Цвет рамки:</label>
            <UiInput
              v-model="nodeBorderColorValue"
              :type="nodeBorderColorInputType"
              size="sm"
              class="property-input small"
              @change="applyNodeBorderColor"
            />
          </div>
          <div class="property">
            <label>Толщина рамки:</label>
            <UiInput
              v-model="nodeBorderWidthValue"
              @change="applyNodeBorderWidth"
              type="number"
              size="sm"
              class="property-input small"
              min="0"
            />
          </div>
          <div class="property">
            <label>Скругление:</label>
            <UiInput
              v-model="nodeBorderRadiusValue"
              @change="applyNodeBorderRadius"
              type="number"
              size="sm"
              class="property-input small"
              min="0"
            />
          </div>
          <div v-if="isSingleNodeSelection" class="property-group">
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
      <div v-else-if="isEdgePanel" class="edge-properties">
        <div class="property-group">
          <h4>Связь</h4>
          <div class="property property--stacked">
            <label>Название:</label>
            <textarea
              v-model="edgeLabelValue"
              class="property-input multiline"
              placeholder="Название связи"
              @change="applyEdgeLabel"
            ></textarea>
          </div>
          <div class="property">
            <label>Стиль линии:</label>
            <UiSelect
              class="property-input"
              :model-value="edgeLineStyleValue"
              size="sm"
              @update:model-value="onEdgeLineStyleChange"
            >
              <option value="" disabled></option>
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
              v-model="edgeColorValue"
              :type="edgeColorInputType"
              size="sm"
              class="property-input small"
              @change="applyEdgeColor"
            />
          </div>
          <div class="property">
            <label>Толщина линии:</label>
            <UiInput
              v-model="edgeWidthValue"
              @change="applyEdgeWidth"
              type="number"
              size="sm"
              class="property-input small"
              min="0"
            />
          </div>

          <div v-if="isSingleEdgeSelection" class="property-group">
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
import { computed, ref, watch } from 'vue'
import UiButton from '@/presentation/ui/UiButton.vue'
import UiInput from '@/presentation/ui/UiInput.vue'
import UiSelect from '@/presentation/ui/UiSelect.vue'
import type { SelectedObject } from '@/domains/diagram'
import type { DataFlow, Edge, LineStyle, Node, NodeLineStyle } from '@/domains/graph'

interface Props {
  selectedObject?: SelectedObject | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
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
  (e: 'delete:selection'): void
  (e: 'clear-selection'): void
  (e: 'update:dataFlows', flows: DataFlow[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

type PanelMode = 'none' | 'mixed' | 'single-node' | 'multi-node' | 'single-edge' | 'multi-edge'

function getCommonValue<T>(items: T[]): T | undefined {
  if (!items.length) return undefined
  const [first, ...rest] = items
  return rest.every(item => item === first) ? first : undefined
}

function isHexColor(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

const selectedNodeIds = computed(() => props.selectedNodeIds ?? [])
const selectedEdgeIds = computed(() => props.selectedEdgeIds ?? [])
const selectedNodes = computed(() => {
  const ids = new Set(selectedNodeIds.value)
  return (props.nodes ?? []).filter(node => ids.has(node.id))
})
const selectedEdges = computed(() => {
  const ids = new Set(selectedEdgeIds.value)
  return (props.edges ?? []).filter(edge => ids.has(edge.id))
})
const panelMode = computed<PanelMode>(() => {
  if (selectedNodes.value.length > 0 && selectedEdges.value.length > 0) return 'mixed'
  if (selectedNodes.value.length === 1) return 'single-node'
  if (selectedNodes.value.length > 1) return 'multi-node'
  if (selectedEdges.value.length === 1) return 'single-edge'
  if (selectedEdges.value.length > 1) return 'multi-edge'
  return 'none'
})
const isNodePanel = computed(() => panelMode.value === 'single-node' || panelMode.value === 'multi-node')
const isEdgePanel = computed(() => panelMode.value === 'single-edge' || panelMode.value === 'multi-edge')
const isSingleNodeSelection = computed(() => panelMode.value === 'single-node')
const isSingleEdgeSelection = computed(() => panelMode.value === 'single-edge')
const singleSelectedNode = computed(() => selectedNodes.value[0] ?? null)
const singleSelectedEdge = computed(() => selectedEdges.value[0] ?? null)

const availableEdges = computed(() => props.edges ?? [])
const nodeLineStyleOptions: { value: NodeLineStyle, label: string }[] = [
  { value: 'solid', label: 'Сплошная' },
  { value: 'dashed', label: 'Пунктирная' },
  { value: 'database', label: 'База данных' },
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
  if (!singleSelectedNode.value) return []
  return (props.dataFlows ?? []).filter(flow => flow.startBlock === singleSelectedNode.value.id)
})

const finishOptions = computed(() => {
  if (!props.nodes) return []
  return props.nodes.map(n => ({ value: n.id, label: n.text || n.id }))
})

const nodeTextValue = ref('')
const nodeInformationTextValue = ref('')
const nodePositionXValue = ref<number | ''>('')
const nodePositionYValue = ref<number | ''>('')
const nodeWidthValue = ref<number | ''>('')
const nodeHeightValue = ref<number | ''>('')
const nodeBorderStyleValue = ref<NodeLineStyle | ''>('')
const nodeColorValue = ref('')
const nodeBorderColorValue = ref('')
const nodeBorderWidthValue = ref<number | ''>('')
const nodeBorderRadiusValue = ref<number | ''>('')
const edgeLabelValue = ref('')
const edgeLineStyleValue = ref<LineStyle | ''>('')
const edgeColorValue = ref('')
const edgeWidthValue = ref<number | ''>('')

const nodeColorInputType = computed(() => (isHexColor(nodeColorValue.value) ? 'color' : 'text'))
const nodeBorderColorInputType = computed(() => (isHexColor(nodeBorderColorValue.value) ? 'color' : 'text'))
const edgeColorInputType = computed(() => (isHexColor(edgeColorValue.value) ? 'color' : 'text'))

watch(
  selectedNodes,
  nodes => {
    nodeTextValue.value = getCommonValue(nodes.map(node => node.text ?? '')) ?? ''
    nodeInformationTextValue.value = getCommonValue(nodes.map(node => node.informationText ?? '')) ?? ''
    nodePositionXValue.value = getCommonValue(nodes.map(node => node.position.x)) ?? ''
    nodePositionYValue.value = getCommonValue(nodes.map(node => node.position.y)) ?? ''
    nodeWidthValue.value = getCommonValue(nodes.map(node => node.width)) ?? ''
    nodeHeightValue.value = getCommonValue(nodes.map(node => node.height)) ?? ''
    nodeBorderStyleValue.value = getCommonValue(nodes.map(node => node.borderStyle ?? 'solid')) ?? ''
    nodeColorValue.value = getCommonValue(nodes.map(node => node.color ?? '#ffffff')) ?? ''
    nodeBorderColorValue.value = getCommonValue(nodes.map(node => node.borderColor ?? '#666666')) ?? ''
    nodeBorderWidthValue.value = getCommonValue(nodes.map(node => node.borderWidth ?? 0)) ?? ''
    nodeBorderRadiusValue.value = getCommonValue(nodes.map(node => node.borderRadius ?? 0)) ?? ''
  },
  { immediate: true, deep: true },
)

watch(
  selectedEdges,
  edges => {
    edgeLabelValue.value = getCommonValue(edges.map(edge => edge.label ?? '')) ?? ''
    edgeLineStyleValue.value = getCommonValue(edges.map(edge => edge.lineStyle ?? 'solid')) ?? ''
    edgeColorValue.value = getCommonValue(edges.map(edge => edge.color ?? '#666666')) ?? ''
    edgeWidthValue.value = getCommonValue(edges.map(edge => edge.width ?? 0)) ?? ''
  },
  { immediate: true, deep: true },
)

function formatEdgeLabel(edge: Edge): string {
  return edge.label?.trim() || edge.id
}

function emitNodeUpdates(updates: Partial<Node>): void {
  selectedNodes.value.forEach(node => {
    emit('update:node', node.id, updates)
  })
}

function emitEdgeUpdates(updates: Partial<Edge>): void {
  selectedEdges.value.forEach(edge => {
    emit('update:edge', edge.id, updates)
  })
}

function applyNodeText(): void {
  emitNodeUpdates({ text: nodeTextValue.value })
}

function applyNodeInformationText(): void {
  emitNodeUpdates({ informationText: nodeInformationTextValue.value })
}

function applyNodePositionX(): void {
  if (nodePositionXValue.value === '') return
  selectedNodes.value.forEach(node => {
    emit('update:node', node.id, {
      position: {
        ...node.position,
        x: Number(nodePositionXValue.value),
      },
    })
  })
}

function applyNodePositionY(): void {
  if (nodePositionYValue.value === '') return
  selectedNodes.value.forEach(node => {
    emit('update:node', node.id, {
      position: {
        ...node.position,
        y: Number(nodePositionYValue.value),
      },
    })
  })
}

function applyNodeWidth(): void {
  if (nodeWidthValue.value === '') return
  emitNodeUpdates({ width: Number(nodeWidthValue.value) })
}

function applyNodeHeight(): void {
  if (nodeHeightValue.value === '') return
  emitNodeUpdates({ height: Number(nodeHeightValue.value) })
}

function onNodeBorderStyleChange(value: string): void {
  const nextValue: NodeLineStyle = value === 'database' || value === 'dashed' ? value : 'solid'
  nodeBorderStyleValue.value = nextValue
  emitNodeUpdates({ borderStyle: nextValue })
}

function applyNodeColor(): void {
  if (!nodeColorValue.value) return
  emitNodeUpdates({ color: nodeColorValue.value })
}

function applyNodeBorderColor(): void {
  if (!nodeBorderColorValue.value) return
  emitNodeUpdates({ borderColor: nodeBorderColorValue.value })
}

function applyNodeBorderWidth(): void {
  if (nodeBorderWidthValue.value === '') return
  emitNodeUpdates({ borderWidth: Number(nodeBorderWidthValue.value) })
}

function applyNodeBorderRadius(): void {
  if (nodeBorderRadiusValue.value === '') return
  emitNodeUpdates({ borderRadius: Number(nodeBorderRadiusValue.value) })
}

function syncInformationIds(nodeId: string, flows: DataFlow[]): void {
  const ids = flows.filter(f => f.startBlock === nodeId).map(f => f.dataKey)
  emit('update:node', nodeId, { informationIds: ids })
}

function onAddDataItem(): void {
  if (!singleSelectedNode.value) return
  const newId = Date.now().toString()
  const flows = [...(props.dataFlows ?? []), {
    dataKey: newId,
    dataName: `Данные ${blockDataItems.value.length + 1}`,
    startBlock: singleSelectedNode.value.id,
    finishBlocks: []
  } satisfies DataFlow]
  emit('update:dataFlows', flows)
  syncInformationIds(singleSelectedNode.value.id, flows)
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
  if (!props.dataFlows || !singleSelectedNode.value) return
  const flows = props.dataFlows.filter(f => f.dataKey !== dataKey)
  emit('update:dataFlows', flows)
  syncInformationIds(singleSelectedNode.value.id, flows)
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
  return singleSelectedNode.value?.passThroughEdges?.includes(edgeId) ?? false
}

function onPassThroughEdgeToggle(edgeId: string, checked: boolean): void {
  if (!singleSelectedNode.value) return
  const current = [...(singleSelectedNode.value.passThroughEdges || [])]
  const index = current.indexOf(edgeId)
  
  if (checked && index === -1) {
    current.push(edgeId)
  } else if (!checked && index !== -1) {
    current.splice(index, 1)
  }
  
  emit('update:node', singleSelectedNode.value.id, {
    passThroughEdges: current
  })
}

function applyEdgeLabel(): void {
  emitEdgeUpdates({ label: edgeLabelValue.value })
}

function onEdgeLineStyleChange(value: string): void {
  const nextValue = value as LineStyle
  edgeLineStyleValue.value = nextValue
  emitEdgeUpdates({ lineStyle: nextValue })
}

function applyEdgeColor(): void {
  if (!edgeColorValue.value) return
  emitEdgeUpdates({ color: edgeColorValue.value })
}

function applyEdgeWidth(): void {
  if (edgeWidthValue.value === '') return
  emitEdgeUpdates({ width: Number(edgeWidthValue.value) })
}

function onEdgeDataKeyToggle(nodeId: string, event: Event): void {
  if (!singleSelectedEdge.value) return
  const checked = (event.target as HTMLInputElement).checked
  const current = [...(singleSelectedEdge.value.dataKeys ?? [])]
  const idx = current.indexOf(nodeId)
  if (checked && idx === -1) {
    current.push(nodeId)
  } else if (!checked && idx !== -1) {
    current.splice(idx, 1)
  }
  // ограничиваем данными исходного блока
  const allowed = edgeDataOptions.value.map(o => o.value)
  const sanitized = current.filter(id => allowed.includes(id))
  emit('update:edge', singleSelectedEdge.value.id, { dataKeys: sanitized })
}

function edgeCarries(nodeId: string): boolean {
  return singleSelectedEdge.value?.dataKeys?.includes(nodeId) ?? false
}

const edgeDataOptions = computed(() => {
  const edge = singleSelectedEdge.value
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
  if (panelMode.value === 'single-node' && singleSelectedNode.value) {
    emit('delete:node', singleSelectedNode.value.id)
    return
  }

  if (panelMode.value === 'single-edge' && singleSelectedEdge.value) {
    emit('delete:edge', singleSelectedEdge.value.id)
    return
  }

  emit('delete:selection')
}

function clearSelection(): void {
  emit('clear-selection')
}
</script>

<style scoped>
.properties-panel {
  width: 100%;
  height: 100%;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
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
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.properties-fieldset {
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
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

.property--stacked {
  align-items: flex-start;
  flex-direction: column;
  gap: 6px;
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
  border-radius: 8px;
  padding: 8px;
  background: #fafafa;
}

.data-row-line {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  margin-bottom: 6px;
}

.data-row-line label {
  min-width: 0;
  color: #495057;
  font-size: 13px;
  font-weight: 500;
}

.data-row-line .property-input {
  width: 100%;
  max-width: none;
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
  width: 100%;
  max-width: none;
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

.hint {
  font-size: 12px;
  color: #6c757d;
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
