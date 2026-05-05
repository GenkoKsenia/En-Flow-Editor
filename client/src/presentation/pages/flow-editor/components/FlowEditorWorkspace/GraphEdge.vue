<template>
  <svg
    class="edge"
    :class="{
      'comment-target-highlighted': isCommentTargetHighlighted,
      'locked-self': lockState === 'self',
      'locked-other': lockState === 'other',
    }"
    :style="{ zIndex: edgeZIndex }"
  >
    <!-- Основной путь стрелки -->
    <!-- Увеличенная зона клика по стрелке (прозрачный дублирующий путь) -->
    <path
      :d="pathData"
      stroke="transparent"
      stroke-width="16"
      fill="none"
      @mousedown="onPathMouseDown"
      class="edge-hit-area"
    />

    <path
      :d="pathData"
      :stroke="strokeColor"
      :stroke-width="strokeWidth"
      fill="none"
      :stroke-dasharray="dashPattern || undefined"
      :stroke-linecap="strokeLinecap"
      :marker-end="markerUrl || undefined"
      :data-edge-path-id="edge.id"
      @mousedown="onPathMouseDown"
      :class="{
        selected: isSelected,
        'comment-target-highlighted': isCommentTargetHighlighted,
        'pass-through-error': hasPassThroughError,
        'locked-self': lockState === 'self',
        'locked-other': lockState === 'other',
      }"
    >
      <title v-if="edgeTitle">{{ edgeTitle }}</title>
    </path>
    
    <!-- Области для перетаскивания средних отрезков (только для 3-сегментных) -->
    <path
      v-if="showDragHandle && edgeType === 'threeSegment'"
      :d="dragHandlePath"
      stroke="transparent"
      stroke-width="20"
      fill="none"
      @mousedown="onDragHandleMouseDown"
      class="drag-handle"
    />
    
    <!-- Визуальные маркеры точек перетаскивания -->
    <circle
      v-if="showDragHandle && edgeType === 'threeSegment' && breakpoint"
      :cx="breakpoint.x"
      :cy="breakpoint.y"
      r="4"
      fill="#0b6bcb"
      class="drag-handle-marker"
    />

    <!-- Подпись стрелки -->
    <text
      v-if="edgeLabel"
      :x="labelPosition?.x"
      :y="labelPosition?.y"
      class="edge-label"
      text-anchor="middle"
      dominant-baseline="middle"
      pointer-events="none"
    >
      {{ edgeLabel }}
    </text>

    <text
      v-if="lockBadgeLabel && labelPosition"
      :x="labelPosition.x"
      :y="(labelPosition.y ?? 0) - 18"
      class="edge-lock-label"
      :class="`edge-lock-label--${lockState}`"
      text-anchor="middle"
      dominant-baseline="middle"
      pointer-events="none"
    >
      {{ lockBadgeLabel }}
    </text>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ConnectionSide, Edge, EdgeGeometry, Node, Position, Segment } from '@/domains/graph'

interface Props {
  edge: Edge
  nodes: Node[]
  type?: 'default' | 'selected' | 'error'
  isSelected?: boolean
  showDragHandle?: boolean
  getConnectionPosition?: (nodeId: string, side: ConnectionSide, connectionId: string) => number
  forceThreeSegments?: boolean
  hasPassThroughError?: boolean
  isPassThrough?: boolean
  isCommentTargetHighlighted?: boolean
  errorMessage?: string | null
  warningMessage?: string | null
  lockedBy?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  isSelected: false,
  showDragHandle: false,
  getConnectionPosition: () => 0.5,
  forceThreeSegments: false,
  hasPassThroughError: false,
  isPassThrough: false,
  isCommentTargetHighlighted: false,
  errorMessage: null,
  warningMessage: null,
  lockedBy: null,
})

const emit = defineEmits<{
  'edge-click': [edgeId: string, event: MouseEvent]
  'breakpoint-drag-start': [edgeId: string, event: MouseEvent] 
}>()

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

const edgeTitle = computed(() => {
  if (props.errorMessage) return props.errorMessage
  if (props.warningMessage) return props.warningMessage
  if (lockState.value === 'other') {
    return props.lockedBy && props.lockedBy !== 'locked'
      ? `Занято: ${props.lockedBy}`
      : 'Занято другим пользователем'
  }
  if (lockState.value === 'self') return 'Заблокировано вами'
  return props.edge.label?.trim() ?? ''
})
const edgeLabel = computed(() => {
  const label = props.edge.label?.trim()
  return label ? label : ''
})

// Выбираем маркер и цвет
const markerUrl = computed(() => {
  const markerType = props.edge.markerType ?? 'triangle'
  if (markerType === 'none') return ''
  const markers: Record<'triangle', Record<'default' | 'selected' | 'error', string>> = {
    triangle: {
      default: 'arrowhead',
      selected: 'arrowhead-selected',
      error: 'arrowhead-error'
    }
  }
  const markerId = markers[markerType]?.[props.type] ?? 'arrowhead'
  return `url(#${markerId})`
})

const strokeColor = computed(() => {
  const base = props.edge.color ?? '#666'
  const selectedColor = '#0b6bcb'
  const colors = {
    default: props.isSelected ? selectedColor : base,
    selected: selectedColor, 
    error: '#dc3545',
  }
  return colors[props.type]
})

const strokeWidth = computed(() => props.edge.width ?? 2)

const dashPattern = computed(() => {
  const styles: Record<string, string> = {
    solid: '',
    dashed: '8 4',
    dotted: '8 4 2 4' // чередуем длинный штрих и точку
  }
  const lineStyle = props.edge.lineStyle ?? 'solid'
  return styles[lineStyle]
})

const strokeLinecap = computed(() => props.edge.lineStyle === 'dotted' ? 'round' : 'butt')

// Получаем точки соединения
const startPoint = computed(() => {
  return getConnectionPoint(props.edge.sourceNodeId, props.edge.sourceSide)
})

const endPoint = computed(() => {
  return getConnectionPoint(props.edge.targetNodeId, props.edge.targetSide)
})

function getConnectionPoint(nodeId: string, side: ConnectionSide): Position {
  const node = props.nodes.find(n => n.id === nodeId)
  if (!node) return { x: 0, y: 0 }
  
  //ВЫЧИСЛЯЕМ АБСОЛЮТНУЮ ПОЗИЦИЮ С УЧЕТОМ ВЛОЖЕННОСТИ
  const absolutePosition = getAbsolutePosition(node, props.nodes)
  
  // Получаем позицию соединения (от 0 до 1)
  const position = props.getConnectionPosition(nodeId, side, props.edge.id)
  
  switch (side) {
    case 'top':
      return { 
        x: absolutePosition.x + node.width * position, 
        y: absolutePosition.y 
      }
    case 'right':
      return { 
        x: absolutePosition.x + node.width, 
        y: absolutePosition.y + node.height * position 
      }
    case 'bottom':
      return { 
        x: absolutePosition.x + node.width * position, 
        y: absolutePosition.y + node.height 
      }
    case 'left':
      return { 
        x: absolutePosition.x, 
        y: absolutePosition.y + node.height * position 
      }
  }
}

const sourceDepth = computed(() => getNodeDepth(props.edge.sourceNodeId))
const targetDepth = computed(() => getNodeDepth(props.edge.targetNodeId))
const edgeLayer = computed(() => Math.max(sourceDepth.value, targetDepth.value))
const edgeZIndex = computed(() => {
  const base = edgeLayer.value * 100 + 40
  return props.isPassThrough ? base + 1000 : base
})

const edgeGeometry = computed((): EdgeGeometry => {
  if (!startPoint.value || !endPoint.value) {
    return {
      segments: [],
      totalLength: 0,
      boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
    }
  }

  const { sourceSide, targetSide } = props.edge
  const start = startPoint.value
  const end = endPoint.value
  
  const segments: Segment[] = []
  let currentPoint = start
  
  // Определяем тип стрелки
  const needsThreeSegments = props.forceThreeSegments ||
    (sourceSide === 'left' && targetSide === 'right') ||
    (sourceSide === 'right' && targetSide === 'left') ||
    (sourceSide === 'top' && targetSide === 'bottom') ||
    (sourceSide === 'bottom' && targetSide === 'top') ||
    (sourceSide === 'left' && targetSide === 'left') ||
    (sourceSide === 'right' && targetSide === 'right') ||
    (sourceSide === 'top' && targetSide === 'top') ||
    (sourceSide === 'bottom' && targetSide === 'bottom')
  
  if (needsThreeSegments) {
    // 3-сегментная стрелка
    const breakpointX = props.edge.breakpointX ?? getDefaultBreakpointX()
    const breakpointY = props.edge.breakpointY ?? getDefaultBreakpointY()
    
    if (sourceSide === 'left' || sourceSide === 'right') {
      // Горизонтальные соединения
      const point1 = { x: breakpointX, y: start.y }
      const point2 = { x: breakpointX, y: end.y }
      
      segments.push(createSegment('segment-1', currentPoint, point1))
      currentPoint = point1
      segments.push(createSegment('segment-2', currentPoint, point2))
      currentPoint = point2
      segments.push(createSegment('segment-3', currentPoint, end))
    } else {
      // Вертикальные соединения
      const point1 = { x: start.x, y: breakpointY }
      const point2 = { x: end.x, y: breakpointY }
      
      segments.push(createSegment('segment-1', currentPoint, point1))
      currentPoint = point1
      segments.push(createSegment('segment-2', currentPoint, point2))
      currentPoint = point2
      segments.push(createSegment('segment-3', currentPoint, end))
    }
  } else {
    // 2-сегментная стрелка
    let bendPoint: Position
    
    if (sourceSide === 'left' || sourceSide === 'right') {
      bendPoint = { x: end.x, y: start.y }
    } else {
      bendPoint = { x: start.x, y: end.y }
    }
    
    segments.push(createSegment('segment-1', start, bendPoint))
    segments.push(createSegment('segment-2', bendPoint, end))
  }
  
  // Вычисляем bounding box и общую длину
  return calculateEdgeGeometry(segments)
})

// Вспомогательная функция для создания отрезка
function createSegment(id: string, start: Position, end: Position): Segment {
  return {
    id: `${props.edge.id}-${id}`,
    type: 'line',
    start,
    end
  }
}

// Функция для вычисления геометрии стрелки
function calculateEdgeGeometry(segments: Segment[]): EdgeGeometry {
  if (segments.length === 0) {
    return {
      segments: [],
      totalLength: 0,
      boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
    }
  }
  
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let totalLength = 0
  
  segments.forEach(segment => {
    // Обновляем bounding box
    minX = Math.min(minX, segment.start.x, segment.end.x)
    minY = Math.min(minY, segment.start.y, segment.end.y)
    maxX = Math.max(maxX, segment.start.x, segment.end.x)
    maxY = Math.max(maxY, segment.start.y, segment.end.y)
    
    // Вычисляем длину отрезка
    const dx = segment.end.x - segment.start.x
    const dy = segment.end.y - segment.start.y
    totalLength += Math.sqrt(dx * dx + dy * dy)
  })
  
  return {
    segments,
    totalLength,
    boundingBox: {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    }
  }
}

// Определяем тип стрелки и создаем путь
const pathData = computed(() => {
  const geometry = edgeGeometry.value
  
  if (geometry.segments.length === 0) return ''
  
  // Собираем SVG path из сегментов
  let path = `M ${geometry.segments[0].start.x} ${geometry.segments[0].start.y}`
  
  geometry.segments.forEach(segment => {
    path += ` L ${segment.end.x} ${segment.end.y}`
  })
  
  return path
})

const labelPosition = computed<Position | null>(() => {
  const geometry = edgeGeometry.value
  if (!geometry.totalLength || geometry.segments.length === 0 || !edgeLabel.value) return null

  const target = geometry.totalLength / 2
  let traversed = 0

  for (const segment of geometry.segments) {
    const dx = segment.end.x - segment.start.x
    const dy = segment.end.y - segment.start.y
    const length = Math.sqrt(dx * dx + dy * dy)
    const next = traversed + length

    if (target <= next) {
      const ratio = (target - traversed) / length || 0
      return {
        x: segment.start.x + dx * ratio,
        y: segment.start.y + dy * ratio
      }
    }

    traversed = next
  }

  const last = geometry.segments[geometry.segments.length - 1]
  return last ? { ...last.end } : null
})

// Функция для вычисления точки излома по умолчанию
function getDefaultBreakpointX(): number {
  const start = startPoint.value!
  const end = endPoint.value!
  const { sourceSide, targetSide } = props.edge
  
  if (sourceSide === 'left' && targetSide === 'left') {
    // Для лево-лево - отступ влево (вне узлов)
    return Math.min(start.x, end.x) - 80
  } else if (sourceSide === 'right' && targetSide === 'right') {
    // Для право-право - отступ вправо (вне узлов)
    return Math.max(start.x, end.x) + 80
  } else {
    // Для лево-право и право-лево - посередине между узлами
    return (start.x + end.x) / 2
  }
}

function getDefaultBreakpointY(): number {
  const start = startPoint.value!
  const end = endPoint.value!
  const { sourceSide, targetSide } = props.edge

  if (sourceSide === 'top' && targetSide === 'top') {
    // для top-top уходим вверх
    return Math.min(start.y, end.y) - 40
  } else if (sourceSide === 'bottom' && targetSide === 'bottom') {
    // для bottom-bottom уходим вниз
    return Math.max(start.y, end.y) + 40
  } else {
    return (start.y + end.y) / 2
  }
}

// Определяем тип стрелки для перетаскивания
const edgeType = computed(() => {
  const { sourceSide, targetSide } = props.edge
  const isOppositeSides = 
    (sourceSide === 'left' && targetSide === 'right') ||
    (sourceSide === 'right' && targetSide === 'left') ||
    (sourceSide === 'top' && targetSide === 'bottom') ||
    (sourceSide === 'bottom' && targetSide === 'top') ||
    (sourceSide === 'left' && targetSide === 'left')  ||
    (sourceSide === 'right' && targetSide === 'right') ||
    (sourceSide === 'top' && targetSide === 'top') ||
    (sourceSide === 'bottom' && targetSide === 'bottom')
  
  return props.forceThreeSegments || isOppositeSides ? 'threeSegment' : 'twoSegment'
})

// Точка перетаскивания для 3-сегментных стрелок
const breakpoint = computed(() => {
  if (edgeType.value !== 'threeSegment') return null
  
  const { sourceSide, targetSide } = props.edge
  const start = startPoint.value!
  const end = endPoint.value!
  
  if (sourceSide === 'left' && targetSide === 'right' || 
      sourceSide === 'right' && targetSide === 'left' ||
      sourceSide === 'left' && targetSide === 'left' ||
      sourceSide === 'right' && targetSide === 'right') {
    // Все горизонтальные 3-сегментные стрелки
    return {
      x: props.edge.breakpointX ?? getDefaultBreakpointX(),
      y: (start.y + end.y) / 2
    }
  } else {
    // Вертикальные 3-сегментные стрелки
    const defaultY = (() => {
      if (sourceSide === 'top' && targetSide === 'top') return Math.min(start.y, end.y) - 40
      if (sourceSide === 'bottom' && targetSide === 'bottom') return Math.max(start.y, end.y) + 40
      return (start.y + end.y) / 2
    })()
    return {
      x: (start.x + end.x) / 2,
      y: props.edge.breakpointY ?? defaultY
    }
  }
})

// Область перетаскивания
const dragHandlePath = computed(() => {
  if (edgeType.value !== 'threeSegment' || !breakpoint.value) return ''
  
  const { sourceSide} = props.edge
  const start = startPoint.value!
  const end = endPoint.value!
  
  // Для всех горизонтальных 3-сегментных стрелок
  if (sourceSide === 'left' || sourceSide === 'right') {
    // Вертикальная линия для перетаскивания - расширяем область для удобства
    const minY = Math.min(start.y, end.y) - 30
    const maxY = Math.max(start.y, end.y) + 30
    return `M ${breakpoint.value.x} ${minY} L ${breakpoint.value.x} ${maxY}`
  } else {
    // Горизонтальная линия для перетаскивания
    const minX = Math.min(start.x, end.x) - 30
    const maxX = Math.max(start.x, end.x) + 30
    return `M ${minX} ${breakpoint.value.y} L ${maxX} ${breakpoint.value.y}`
  }
})

// Обработчики событий
function onPathMouseDown(event: MouseEvent): void {
  emit('edge-click', props.edge.id, event)
}

function onDragHandleMouseDown(event: MouseEvent): void {
  emit('breakpoint-drag-start', props.edge.id, event) 
  event.stopPropagation()
}

function getAbsolutePosition(node: Node, nodes: Node[]): Position {
  if (!node.parentId) return node.position
  
  const parent = nodes.find(n => n.id === node.parentId)
  if (!parent) return node.position
  
  const parentAbsolute = getAbsolutePosition(parent, nodes)
  return {
    x: parentAbsolute.x + node.position.x,
    y: parentAbsolute.y + node.position.y
  }
}

function getNodeDepth(nodeId: string, nodes: Node[] = props.nodes, depth = 0): number {
  const node = nodes.find(n => n.id === nodeId)
  if (!node || !node.parentId) {
    return depth
  }
  return getNodeDepth(node.parentId, nodes, depth + 1)
}
</script>

<style scoped>
.edge {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  transform: translate(var(--drag-dx, 0px), var(--drag-dy, 0px));
}

.edge path {
  pointer-events: all;
}

.edge path.pass-through-error {
  filter:
    drop-shadow(0 0 0 rgba(217, 72, 95))   
    drop-shadow(0 0 3px rgba(217, 72, 95)); 
}

.edge-hit-area {
  pointer-events: all;
}

.edge path.selected {
  stroke: #0b6bcb;
  stroke-width: 3;
}

.edge path.comment-target-highlighted {
  stroke: #0b6bcb;
  stroke-width: 4;
  filter: drop-shadow(0 0 4px rgba(11, 107, 203, 0.42));
}

.edge path.locked-self {
  stroke: #0b6bcb;
  filter: drop-shadow(0 0 4px rgba(11, 107, 203, 0.38));
}

.edge path.locked-other,
.edge.locked-other .drag-handle {
  stroke: #d9485f;
  cursor: not-allowed;
  filter: drop-shadow(0 0 4px rgba(217, 72, 95, 0.38));
}

.drag-handle {
  pointer-events: all;
  cursor: col-resize;
}

.drag-handle-marker {
  pointer-events: none;
}

.edge-label {
  fill: #333;
  font-size: 12px;
  font-family: Arial, sans-serif;
  paint-order: stroke;
  stroke: white;
  stroke-width: 2px;
}

.edge-lock-label {
  font-size: 11px;
  font-weight: 700;
  paint-order: stroke;
  stroke: #ffffff;
  stroke-width: 3px;
}

.edge-lock-label--self {
  fill: #0b6bcb;
}

.edge-lock-label--other {
  fill: #d9485f;
}
</style>
