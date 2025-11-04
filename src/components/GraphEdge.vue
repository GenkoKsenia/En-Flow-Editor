<template>
  <svg class="edge">
    <!-- Основной путь стрелки -->
    <path
      :d="pathData"
      :stroke="strokeColor"
      stroke-width="2"
      fill="none"
      :marker-end="markerUrl"
      @mousedown="onPathMouseDown"
      :class="{ selected: isSelected }"
    />
    
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
      fill="#007bff"
      class="drag-handle-marker"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Edge, Node, ConnectionSide, Position } from '../types'

interface Props {
  edge: Edge
  nodes: Node[]
  type?: 'default' | 'selected' | 'error'
  isSelected?: boolean
  showDragHandle?: boolean
  getConnectionPosition?: (nodeId: string, side: ConnectionSide, connectionId: string) => number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  isSelected: false,
  showDragHandle: false,
  getConnectionPosition: () => 0.5
})

const emit = defineEmits<{
  'edge-click': [edgeId: string, event: MouseEvent]
  'breakpoint-drag-start': [edgeId: string, event: MouseEvent] 
}>()

// Выбираем маркер и цвет
const markerUrl = computed(() => {
  const markers = {
    default: 'url(#arrowhead)',
    selected: 'url(#arrowhead-selected)',
    error: 'url(#arrowhead-error)',
  }
  return markers[props.type]
})

const strokeColor = computed(() => {
  const colors = {
    default: props.isSelected ? '#007bff' : '#666',
    selected: '#007bff', 
    error: '#dc3545',
  }
  return colors[props.type]
})

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
  
  // Получаем позицию соединения (от 0 до 1)
  const position = props.getConnectionPosition(nodeId, side, props.edge.id)
  
  switch (side) {
    case 'top':
      return { 
        x: node.position.x + node.width * position, 
        y: node.position.y 
      }
    case 'right':
      return { 
        x: node.position.x + node.width, 
        y: node.position.y + node.height * position 
      }
    case 'bottom':
      return { 
        x: node.position.x + node.width * position, 
        y: node.position.y + node.height 
      }
    case 'left':
      return { 
        x: node.position.x, 
        y: node.position.y + node.height * position 
      }
  }
}

// Определяем тип стрелки и создаем путь
const pathData = computed(() => {
  if (!startPoint.value || !endPoint.value) return ''
  
  const { sourceSide, targetSide } = props.edge
  
  // Определяем, нужна ли стрелка из трех отрезков 
  const needsThreeSegments = 
    (sourceSide === 'left' && targetSide === 'right') ||
    (sourceSide === 'right' && targetSide === 'left') ||
    (sourceSide === 'top' && targetSide === 'bottom') ||
    (sourceSide === 'bottom' && targetSide === 'top') ||
    (sourceSide === 'left' && targetSide === 'left') ||
    (sourceSide === 'right' && targetSide === 'right')
  
  if (needsThreeSegments) {
    // 3 отрезка для противоположных сторон
    return createThreeSegmentPath()
  } else {
    // 2 отрезка для всех остальных комбинаций сторон
    return createTwoSegmentPath()
  }
})

function createTwoSegmentPath(): string {
  const { sourceSide } = props.edge
  const start = startPoint.value!
  const end = endPoint.value!
  
  // Для стрелок из двух отрезков точка изгиба должна быть на пересечении:
  // - горизонтальной линии от начальной точки и вертикальной линии от конечной точки, ИЛИ
  // - вертикальной линии от начальной точки и горизонтальной линии от конечной точки
  
  let bendPoint: Position
  
  if (sourceSide === 'left' || sourceSide === 'right') {
    // Для горизонтальных исходных сторон (left/right) - сначала горизонтальное движение, затем вертикальное
    bendPoint = { x: end.x, y: start.y }
  } else {
    // Для вертикальных исходных сторон (top/bottom) - сначала вертикальное движение, затем горизонтальное
    bendPoint = { x: start.x, y: end.y }
  }
  
  return `M ${start.x} ${start.y} L ${bendPoint.x} ${bendPoint.y} L ${end.x} ${end.y}`
}

function createThreeSegmentPath(): string {
  const { sourceSide, targetSide } = props.edge
  const start = startPoint.value!
  const end = endPoint.value!
  
  // Используем сохраненную точку излома или вычисляем по умолчанию
  const breakpointX = props.edge.breakpointX ?? getDefaultBreakpointX()
  const breakpointY = props.edge.breakpointY ?? (start.y + end.y) / 2
  
  if (sourceSide === 'left' && targetSide === 'right' || sourceSide === 'right' && targetSide === 'left') {
    // Лево-право или право-лево: сначала горизонтально, потом вертикально, потом горизонтально
    return `M ${start.x} ${start.y} L ${breakpointX} ${start.y} L ${breakpointX} ${end.y} L ${end.x} ${end.y}`
  } else if (sourceSide === 'right' && targetSide === 'right') {
    // Право-право: сначала вправо, потом вертикально, потом влево
    return `M ${start.x} ${start.y} L ${breakpointX} ${start.y} L ${breakpointX} ${end.y} L ${end.x} ${end.y}`
  } else if (sourceSide === 'left' && targetSide === 'left') {
    // Лево-лево: сначала влево, потом вертикально, потом вправо
    return `M ${start.x} ${start.y} L ${breakpointX} ${start.y} L ${breakpointX} ${end.y} L ${end.x} ${end.y}`
  } else {
    // Вертикальные соединения: сначала вертикально, потом горизонтально, потом вертикально
    return `M ${start.x} ${start.y} L ${start.x} ${breakpointY} L ${end.x} ${breakpointY} L ${end.x} ${end.y}`
  }
}

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

// Определяем тип стрелки для перетаскивания
const edgeType = computed(() => {
  const { sourceSide, targetSide } = props.edge
  const isOppositeSides = 
    (sourceSide === 'left' && targetSide === 'right') ||
    (sourceSide === 'right' && targetSide === 'left') ||
    (sourceSide === 'top' && targetSide === 'bottom') ||
    (sourceSide === 'bottom' && targetSide === 'top') ||
    (sourceSide === 'left' && targetSide === 'left')  ||
    (sourceSide === 'right' && targetSide === 'right')
  
  return isOppositeSides ? 'threeSegment' : 'twoSegment'
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
    return {
      x: (start.x + end.x) / 2,
      y: props.edge.breakpointY ?? (start.y + end.y) / 2
    }
  }
})

// Область перетаскивания
const dragHandlePath = computed(() => {
  if (edgeType.value !== 'threeSegment' || !breakpoint.value) return ''
  
  const { sourceSide, targetSide } = props.edge
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
}

.edge path {
  pointer-events: all;
}

.edge path.selected {
  stroke-width: 3;
}

.drag-handle {
  pointer-events: all;
  cursor: col-resize;
}

.drag-handle-marker {
  pointer-events: none;
}
</style>