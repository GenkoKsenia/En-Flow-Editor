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
      'db-table-node': isDbTableContainer,
      'db-column-node': isDbTableColumn,
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

    <svg
      v-if="isDatabaseBorder"
      class="node-database-shape"
      :viewBox="databaseShapeMetrics.viewBox"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        :d="databaseShapeMetrics.fillPath"
        :fill="nodeBackground"
      />
      <ellipse
        :cx="databaseShapeMetrics.centerX"
        :cy="databaseShapeMetrics.ellipseCenterY"
        :rx="databaseShapeMetrics.ellipseRx"
        :ry="databaseShapeMetrics.ellipseRy"
        :fill="nodeBackground"
        :stroke="borderColor"
        :stroke-width="databaseShapeMetrics.strokeWidth"
      />
      <line
        :x1="databaseShapeMetrics.leftX"
        :y1="databaseShapeMetrics.sideTopY"
        :x2="databaseShapeMetrics.leftX"
        :y2="databaseShapeMetrics.sideBottomY"
        :stroke="borderColor"
        :stroke-width="databaseShapeMetrics.strokeWidth"
      />
      <line
        :x1="databaseShapeMetrics.rightX"
        :y1="databaseShapeMetrics.sideTopY"
        :x2="databaseShapeMetrics.rightX"
        :y2="databaseShapeMetrics.sideBottomY"
        :stroke="borderColor"
        :stroke-width="databaseShapeMetrics.strokeWidth"
      />
      <path
        :d="databaseShapeMetrics.bottomArcPath"
        :fill="'none'"
        :stroke="borderColor"
        :stroke-width="databaseShapeMetrics.strokeWidth"
      />
    </svg>

    <div
      class="node-content"
      :class="{
        'node-content--with-info': informationText,
        'node-content--table': isDbTableContainer,
        'node-content--column': isDbTableColumn,
      }"
    >
      <div class="node-title">
        {{ node.text }}
      </div>
      <div v-if="informationText && !isDbTableContainer" class="node-information">
        {{ informationText }}
      </div>
    </div>

    <!-- Индикаторы сторон для соединения -->
    <div v-if="showConnectionHints" class="connection-hints">
      <div v-if="allowedConnectionSides.includes('top')" class="side-hint top" :class="{ active: hoveredSide === 'top' }"></div>
      <div class="side-hint right" :class="{ active: hoveredSide === 'right' }"></div>
      <div v-if="allowedConnectionSides.includes('bottom')" class="side-hint bottom" :class="{ active: hoveredSide === 'bottom' }"></div>
      <div class="side-hint left" :class="{ active: hoveredSide === 'left' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  getAllowedConnectionSidesForBorderStyle,
  isDatabaseBorderStyle,
  type ConnectionSide,
  type Node,
  type Position,
} from '@/domains/graph'

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
const directChildren = computed(() => props.allNodes.filter(node => node.parentId === props.node.id))
const parentNode = computed(() =>
  props.node.parentId
    ? props.allNodes.find(node => node.id === props.node.parentId) ?? null
    : null,
)
const isBoundaryNode = computed(() => props.node.text.startsWith('Область '))
const isDbTableContainer = computed(() => (
  !isBoundaryNode.value
  && directChildren.value.length > 0
  && directChildren.value.every(child =>
    !props.allNodes.some(node => node.parentId === child.id),
  )
))
const isDbTableColumn = computed(() => {
  if (!parentNode.value) return false

  const parentChildren = props.allNodes.filter(node => node.parentId === parentNode.value?.id)
  return (
    !parentNode.value.text.startsWith('Область ')
    && parentChildren.length > 0
    && parentChildren.every(child =>
      !props.allNodes.some(node => node.parentId === child.id),
    )
  )
})
const nodeBorderClass = computed(() => `border-style-${props.node.borderStyle ?? 'solid'}`)
const isDatabaseBorder = computed(() => isDatabaseBorderStyle(props.node.borderStyle))
const allowedConnectionSides = computed(() => getAllowedConnectionSidesForBorderStyle(props.node.borderStyle))
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
const informationText = computed(() => props.node.informationText?.trim() ?? '')
const borderColor = computed(() => getBorderColor())
const nodeBackground = computed(() => props.node.color ?? 'white')
const databaseShapeMetrics = computed(() => {
  const strokeWidth = Math.max(props.node.borderWidth ?? 2, 1)
  const width = Math.max(props.node.width, strokeWidth * 2 + 24)
  const height = Math.max(props.node.height, strokeWidth * 2 + 32)
  const ellipseRy = Math.min(18, Math.max(8, height * 0.18))
  const ellipseRx = Math.max(width / 2 - strokeWidth / 2, 1)
  const centerX = width / 2
  const ellipseCenterY = ellipseRy
  const sideTopY = ellipseCenterY
  const sideBottomY = height - ellipseCenterY
  const leftX = strokeWidth / 2
  const rightX = width - strokeWidth / 2
  const topControlY = strokeWidth / 2
  const bottomControlY = height - strokeWidth / 2

  return {
    viewBox: `0 0 ${width} ${height}`,
    strokeWidth,
    centerX,
    ellipseCenterY,
    ellipseRx,
    ellipseRy: Math.max(ellipseRy - strokeWidth / 2, 1),
    leftX,
    rightX,
    sideTopY,
    sideBottomY,
    fillPath: [
      `M ${leftX} ${sideTopY}`,
      `C ${leftX} ${topControlY} ${rightX} ${topControlY} ${rightX} ${sideTopY}`,
      `L ${rightX} ${sideBottomY}`,
      `C ${rightX} ${bottomControlY} ${leftX} ${bottomControlY} ${leftX} ${sideBottomY}`,
      'Z',
    ].join(' '),
    bottomArcPath: `M ${leftX} ${sideBottomY} C ${leftX} ${bottomControlY} ${rightX} ${bottomControlY} ${rightX} ${sideBottomY}`,
  }
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
    '--border-color': borderColor.value,
    '--border-width': `${borderWidth}px`,
    '--border-radius': `${borderRadius}px`,
    '--node-background': nodeBackground.value,
    background: isDatabaseBorder.value ? 'transparent' : nodeBackground.value,
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
  const side = getClosestSide(x, y, props.node.width, props.node.height, allowedConnectionSides.value)
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

function getClosestSide(
  x: number,
  y: number,
  width: number,
  height: number,
  sides: readonly ConnectionSide[],
): ConnectionSide | null {
  // Делаем зону попадания по грани шире, но не дальше середины короткой стороны
  const threshold = Math.min(28, Math.min(width, height) / 2)

  const distances = sides.map(side => ({
    side,
    distance: side === 'top'
      ? y
      : side === 'right'
        ? width - x
        : side === 'bottom'
          ? height - y
          : x,
  }))

  if (!distances.length) return null

  const closest = distances.reduce((current, next) => (
    next.distance < current.distance ? next : current
  ))

  return closest.distance <= threshold ? closest.side : null
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

.node-database-shape {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
}

.lock-badge {
  position: absolute;
  top: -12px;
  right: -10px;
  z-index: 2;
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

.node.border-style-database {
  border: none;
  border-radius: 0;
  padding: 18px 12px 14px;
  background: transparent !important;
  box-shadow: none;
}

.node-content {
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: inherit;
}

.node-content--with-info {
  gap: 6px;
}

.node-title {
  width: 100%;
  color: inherit;
  font-weight: 500;
}

.node-content--table {
  align-items: center;
  justify-content: flex-start;
  text-align: center;
}

.node-content--table .node-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.node-content--column {
  justify-content: center;
}

.node-information {
  width: 100%;
  font-size: 12px;
  line-height: 1.2;
  color: rgba(15, 23, 42, 0.82);
}

.node:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.node.border-style-database:hover {
  box-shadow: none;
}

.node.border-style-database:hover .node-database-shape {
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
}

.node.selected {
  --border-color: #0b6bcb;
  box-shadow: 0 0 0 3px rgba(11, 107, 203, 0.25);
}

.node.border-style-database.selected {
  box-shadow: none;
}

.node.connection-source {
  --border-color: #1f9d55;
  box-shadow: 0 0 0 3px rgba(31, 157, 85, 0.22);
}

.node.border-style-database.connection-source {
  box-shadow: none;
}

.node.connection-target {
  --border-color: #1f9d55;
  box-shadow: 0 0 0 3px rgba(31, 157, 85, 0.22);
}

.node.border-style-database.connection-target {
  box-shadow: none;
}

.node.dragging {
  cursor: grabbing;
  box-shadow: 0 6px 20px rgba(0,0,0,0.2);
  z-index: 1000;
}

.node.border-style-database.dragging {
  box-shadow: none;
}

.node.border-style-database.dragging .node-database-shape {
  filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.2));
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

.node.border-style-database.potential-parent {
  box-shadow: none;
}

.node.has-children {
  align-items: flex-start;
  justify-content: flex-start;
  text-align: center;
  padding-top: 2px;
}

.node.db-table-node {
  padding: 10px 12px 12px;
  background: #f8fafc;
}

.node.db-column-node {
  padding: 8px 12px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
}

.node.pass-through-error {
  box-shadow: 0 0 0 3px rgba(217, 72, 95, 0.55);
}

.node.border-style-database.pass-through-error {
  box-shadow: none;
}

.node.data-flow-error {
  box-shadow: 0 0 0 3px rgba(217, 72, 95, 0.55);
}

.node.border-style-database.data-flow-error {
  box-shadow: none;
}

.node.missing-target {
  box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.45);
}

.node.border-style-database.missing-target {
  box-shadow: none;
}

.node.forbidden-outgoing {
  box-shadow: 0 0 0 3px rgba(217, 72, 95, 0.55);
}

.node.border-style-database.forbidden-outgoing {
  box-shadow: none;
}

.node.comment-target-highlighted {
  --border-color: #0b6bcb;
  box-shadow:
    0 0 0 4px rgba(11, 107, 203, 0.22),
    0 0 18px rgba(11, 107, 203, 0.3);
}

.node.border-style-database.comment-target-highlighted {
  box-shadow: none;
}

.node.locked-self {
  --border-color: #0b6bcb;
  box-shadow:
    0 0 0 3px rgba(11, 107, 203, 0.25),
    0 4px 14px rgba(11, 107, 203, 0.18);
}

.node.border-style-database.locked-self {
  box-shadow: none;
}

.node.locked-other {
  --border-color: #d9485f;
  box-shadow:
    0 0 0 3px rgba(217, 72, 95, 0.25),
    0 4px 14px rgba(217, 72, 95, 0.18);
  cursor: not-allowed;
}

.node.border-style-database.locked-other {
  box-shadow: none;
}
</style>
