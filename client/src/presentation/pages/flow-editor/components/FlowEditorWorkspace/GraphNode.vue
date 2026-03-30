<template>
  <div
    class="node"
    :style="nodeStyle"
    :class="{
      selected: selected,
      'connection-source': isConnectionSource,
      'connection-target': isConnectionTarget,
      dragging: isDragging,
      'child-node': !!node.parentId, 
      'potential-parent': isPotentialParent,
      'has-children': hasChildren,
      'pass-through-error': hasPassThroughError,
      'data-flow-error': hasDataError,
      'missing-target': hasMissingTarget,
      'forbidden-outgoing': hasForbiddenOutgoing,
      locked: isLocked,
      [nodeBorderClass]: true
    }"
    :title="tooltipText"
    @mousedown="onMouseDown"
    @click="onClick"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div class="node-title">
      {{ node.text }}
    </div>

    <!-- Индикаторы сторон для соединения -->
    <div v-if="showConnectionHints" class="connection-hints">
      <div class="side-hint top" :class="{ active: hoveredSide === 'top' }"></div>
      <div class="side-hint right" :class="{ active: hoveredSide === 'right' }"></div>
      <div class="side-hint bottom" :class="{ active: hoveredSide === 'bottom' }"></div>
      <div class="side-hint left" :class="{ active: hoveredSide === 'left' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ConnectionSide, Node, Position } from '@/domains/graph'

interface Props {
  node: Node
  selected?: boolean
  isConnectionSource?: boolean
  isConnectionTarget?: boolean
  isDragging?: boolean
  showConnectionHints?: boolean
  childrenCount?: number
  isPotentialParent?: boolean
  allNodes?: Node[] // Все узлы для вычисления абсолютной позиции
  hasPassThroughError?: boolean
  hasDataError?: boolean
  hasMissingTarget?: boolean
  hasForbiddenOutgoing?: boolean
  errorMessage?: string | null
  warningMessage?: string | null
  isLocked?: boolean
  lockedBy?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  isConnectionSource: false,
  isConnectionTarget: false,
  isDragging: false,
  showConnectionHints: false,
  childrenCount: 0,
  isPotentialParent: false,
  allNodes: () => [],
  hasPassThroughError: false,
  hasDataError: false,
  hasMissingTarget: false,
  hasForbiddenOutgoing: false,
  errorMessage: null,
  warningMessage: null,
  isLocked: false,
  lockedBy: null,
})

const emit = defineEmits<{
  'node-mousedown': [nodeId: string, event: MouseEvent]
  'node-click': [nodeId: string, event: MouseEvent]
  'node-hover-side': [nodeId: string, side: ConnectionSide | null]
}>()

const hoveredSide = ref<ConnectionSide | null>(null)

// Вычисляем абсолютную позицию узла с учетом родителя
function getAbsolutePosition(node: Node, nodes: Node[]): Position {
  if (!node.parentId) {
    return node.position
  }
  
  const parent = nodes.find(n => n.id === node.parentId)
  if (!parent) {
    return node.position
  }
  
  const parentAbsolute = getAbsolutePosition(parent, nodes)
  return {
    x: parentAbsolute.x + node.position.x,
    y: parentAbsolute.y + node.position.y
  }
}

const nodeDepth = computed(() => calculateNodeDepth(props.node, props.allNodes))
const hasChildren = computed(() => props.childrenCount > 0)
const nodeBorderClass = computed(() => `border-style-${props.node.borderStyle ?? 'solid'}`)

const nodeStyle = computed(() => {
  // Вычисляем абсолютную позицию для отображения
  const absolutePos = getAbsolutePosition(props.node, props.allNodes)
  const baseZIndex = nodeDepth.value * 100 + 50
  const zIndex = props.isDragging ? baseZIndex + 1000 : baseZIndex
  const borderWidth = props.node.borderWidth ?? 2
  const borderRadius = props.node.borderRadius ?? 8
  
  return {
    left: `${absolutePos.x}px`,
    top: `${absolutePos.y}px`,
    width: `${props.node.width}px`,
    height: `${props.node.height}px`,
    transform: props.isDragging ? 'translate(var(--drag-dx), var(--drag-dy))' : 'none',
    zIndex,
    '--border-color': getBorderColor(),
    '--border-width': `${borderWidth}px`,
    '--border-radius': `${borderRadius}px`,
    background: props.node.color ?? 'white'
  }
})

const tooltipText = computed<string | undefined>(() => {
  if (props.errorMessage) return props.errorMessage
  if (props.warningMessage) return props.warningMessage
  if (props.isLocked) {
    return props.lockedBy && props.lockedBy !== 'locked'
      ? `Занято: ${props.lockedBy}`
      : 'Занято другим пользователем'
  }
  return undefined
})

function getBorderColor(): string {
  if (props.isConnectionSource) {
    return '#28a745'
  }
  if (props.isConnectionTarget) {
    return '#ffc107'
  }
  if (props.selected) {
    return '#007bff'
  }
  return props.node.borderColor ?? '#4CAF50'
}

function calculateNodeDepth(node: Node, nodes: Node[], depth = 0): number {
  if (!node.parentId) {
    return depth
  }
  const parent = nodes.find(n => n.id === node.parentId)
  if (!parent) {
    return depth
  }
  return calculateNodeDepth(parent, nodes, depth + 1)
}

function onMouseDown(event: MouseEvent) {
  emit('node-mousedown', props.node.id, event)
}

function onClick(event: MouseEvent) {
  emit('node-click', props.node.id, event)
}

function onMouseMove(event: MouseEvent) {
  if (!props.showConnectionHints) return
  
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  // Определяем ближайшую сторону с учетом порога
  const side = getClosestSide(x, y, props.node.width, props.node.height)
  if (side !== hoveredSide.value) {
    hoveredSide.value = side
    emit('node-hover-side', props.node.id, side)
  }
}

function onMouseLeave() {
  if (props.showConnectionHints) {
    hoveredSide.value = null
    emit('node-hover-side', props.node.id, null)
  }
}

function getClosestSide(x: number, y: number, width: number, height: number): ConnectionSide | null {
  // Делаем зону попадания по грани шире, но не дальше середины короткой стороны
  const threshold = Math.min(28, Math.min(width, height) / 2)
  
  // Вычисляем расстояния до каждой стороны
  const topDist = y
  const rightDist = width - x
  const bottomDist = height - y
  const leftDist = x
  
  // Находим минимальное расстояние
  const minDist = Math.min(topDist, rightDist, bottomDist, leftDist)
  
  // Если минимальное расстояние больше порога, сторона не выбрана
  if (minDist > threshold) return null
  
  // Возвращаем сторону с минимальным расстоянием
  if (minDist === topDist) return 'top'
  if (minDist === rightDist) return 'right'
  if (minDist === bottomDist) return 'bottom'
  return 'left'
}

</script>

<style scoped>

.node {
  position: absolute;
  background: white;
  border-width: var(--border-width, 2px);
  border-style: solid;
  border-color: var(--border-color, #4CAF50);
  border-radius: var(--border-radius, 8px);
  padding: 10px;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 14px;
  transition: box-shadow 0.2s ease, transform 0s;
}

.node.border-style-solid {
  border-style: solid;
}

.node.border-style-dashed {
  border-style: dashed;
}


.node-title {
  width: 100%;
  color: inherit;
}

.node:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.node.selected {
  --border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.node.connection-source {
  --border-color: #28a745;
  box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.25);
}

.node.connection-target {
  --border-color: #ffc107;
  box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.25);
}

.node.dragging {
  cursor: grabbing;
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
  z-index: 1000;
}

.connection-hints {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.side-hint {
  position: absolute;
  background: transparent;
  transition: all 0.2s ease;
}

.side-hint.active {
  background: #e75629;
}

.side-hint.top {
  top: -2px;
  left: 10px;
  right: 10px;
  height: 2px;
}

.side-hint.right {
  top: 10px;
  right: -2px;
  bottom: 10px;
  width: 2px;
}

.side-hint.bottom {
  bottom: -2px;
  left: 10px;
  right: 10px;
  height: 2px;
}

.side-hint.left {
  top: 10px;
  left: -2px;
  bottom: 10px;
  width: 2px;
}

.node.potential-parent {
  box-shadow: 0 0 0 3px #28a745;
}

.node.has-children {
  align-items: flex-start;
  justify-content: flex-start;
  text-align: center;
  padding-top: 2px;
}

.node.pass-through-error {
  box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.55);
}

.node.data-flow-error {
  box-shadow: 0 0 0 3px rgba(224, 49, 49, 0.55);
}

.node.missing-target {
  box-shadow: 0 0 0 3px rgba(255, 196, 0, 0.55);
}

.node.forbidden-outgoing {
  box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.55);
}

.node.locked {
  opacity: 0.7;
}
</style>
