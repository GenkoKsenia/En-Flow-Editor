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
      'comment-target-highlighted': isCommentTargetHighlighted,
      'locked-self': lockState === 'self',
      'locked-other': lockState === 'other',
      [nodeBorderClass]: true
    }"
    :title="tooltipText"
    @mousedown="onMouseDown"
    @click="onClick"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div v-if="lockBadgeLabel" class="lock-badge" :class="`lock-badge--${lockState}`">
      {{ lockBadgeLabel }}
    </div>

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
import { computed, ref, watch } from 'vue'
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
  isCommentTargetHighlighted?: boolean
  errorMessage?: string | null
  warningMessage?: string | null
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
  isCommentTargetHighlighted: false,
  errorMessage: null,
  warningMessage: null,
  lockedBy: null,
})

const emit = defineEmits<{
  'node-mousedown': [nodeId: string, event: MouseEvent]
  'node-click': [nodeId: string, event: MouseEvent]
  'node-hover-side': [nodeId: string, side: ConnectionSide | null]
}>()

const hoveredSide = ref<ConnectionSide | null>(null)

watch(
  () => props.showConnectionHints,
  isVisible => {
    if (!isVisible) {
      hoveredSide.value = null
    }
  },
)

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
const lockState = computed<'self' | 'other' | null>(() => {
  if (props.lockedBy === 'self') return 'self'
  if (props.lockedBy) return 'other'
  return null
})
const lockBadgeLabel = computed(() => {
  if (lockState.value === 'self') return 'Вы'
  if (lockState.value === 'other') {
    return props.lockedBy === 'locked' ? 'Занято' : props.lockedBy
  }
  return null
})

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
  if (lockState.value === 'other') {
    return props.lockedBy && props.lockedBy !== 'locked'
      ? `Занято: ${props.lockedBy}`
      : 'Занято другим пользователем'
  }
  if (lockState.value === 'self') return 'Заблокировано вами'
  return undefined
})

function getBorderColor(): string {
  if (props.isConnectionSource) {
    return '#1f9d55'
  }
  if (props.isConnectionTarget) {
    return '#1f9d55'
  }
  if (props.selected) {
    return '#0b6bcb'
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

.lock-badge {
  position: absolute;
  top: -12px;
  right: -10px;
  max-width: 110px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.18);
}

.lock-badge--self {
  background: #0b6bcb;
}

.lock-badge--other {
  background: #d9485f;
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
  --border-color: #0b6bcb;
  box-shadow: 0 0 0 3px rgba(11, 107, 203, 0.25);
}

.node.connection-source {
  --border-color: #1f9d55;
  box-shadow: 0 0 0 3px rgba(31, 157, 85, 0.22);
}

.node.connection-target {
  --border-color: #1f9d55;
  box-shadow: 0 0 0 3px rgba(31, 157, 85, 0.22);
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
  background: #1f9d55;
  box-shadow: 0 0 0 1px rgba(31, 157, 85, 0.18);
}

.side-hint.top {
  top: -4px;
  left: 8px;
  right: 8px;
  height: 4px;
}

.side-hint.right {
  top: 8px;
  right: -4px;
  bottom: 8px;
  width: 4px;
}

.side-hint.bottom {
  bottom: -4px;
  left: 8px;
  right: 8px;
  height: 4px;
}

.side-hint.left {
  top: 8px;
  left: -4px;
  bottom: 8px;
  width: 4px;
}

.node.potential-parent {
  box-shadow: 0 0 0 3px #1f9d55;
}

.node.has-children {
  align-items: flex-start;
  justify-content: flex-start;
  text-align: center;
  padding-top: 2px;
}

.node.pass-through-error {
  box-shadow: 0 0 0 3px rgba(217, 72, 95, 0.55);
}

.node.data-flow-error {
  box-shadow: 0 0 0 3px rgba(217, 72, 95, 0.55);
}

.node.missing-target {
  box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.45);
}

.node.forbidden-outgoing {
  box-shadow: 0 0 0 3px rgba(217, 72, 95, 0.55);
}

.node.comment-target-highlighted {
  --border-color: #0b6bcb;
  box-shadow:
    0 0 0 4px rgba(11, 107, 203, 0.22),
    0 0 18px rgba(11, 107, 203, 0.3);
}

.node.locked-self {
  --border-color: #0b6bcb;
  box-shadow:
    0 0 0 3px rgba(11, 107, 203, 0.25),
    0 4px 14px rgba(11, 107, 203, 0.18);
}

.node.locked-other {
  --border-color: #d9485f;
  box-shadow:
    0 0 0 3px rgba(217, 72, 95, 0.25),
    0 4px 14px rgba(217, 72, 95, 0.18);
  cursor: not-allowed;
}
</style>
