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
import type { Edge, Node, ConnectionSide, Position, Segment, EdgeGeometry } from '../types'

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
  const needsThreeSegments = 
    (sourceSide === 'left' && targetSide === 'right') ||
    (sourceSide === 'right' && targetSide === 'left') ||
    (sourceSide === 'top' && targetSide === 'bottom') ||
    (sourceSide === 'bottom' && targetSide === 'top') ||
    (sourceSide === 'left' && targetSide === 'left') ||
    (sourceSide === 'right' && targetSide === 'right')
  
  if (needsThreeSegments) {
    // 3-сегментная стрелка
    const breakpointX = props.edge.breakpointX ?? getDefaultBreakpointX()
    const breakpointY = props.edge.breakpointY ?? (start.y + end.y) / 2
    
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

.drag-handle {
  pointer-events: all;
  cursor: col-resize;
}

.drag-handle-marker {
  pointer-events: none;
}
</style>