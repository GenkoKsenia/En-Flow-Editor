<template>
  <svg class="edge">
    <path
      :d="pathData"
      :stroke="strokeColor"
      stroke-width="2"
      fill="none"
      :marker-end="markerUrl"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Edge, Node } from '../types'

interface Props {
  edge: Edge
  nodes: Node[]
  type?: 'default' | 'selected' | 'error'
  // Добавляем информацию о количестве связей
  sourceConnectionsCount?: number
  sourceConnectionIndex?: number
  targetConnectionsCount?: number
  targetConnectionIndex?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  sourceConnectionsCount: 1,
  sourceConnectionIndex: 0,
  targetConnectionsCount: 1,
  targetConnectionIndex: 0
})

// Выбираем маркер в зависимости от типа
const markerUrl = computed(() => {
  const markers = {
    default: 'url(#arrowhead)',
    selected: 'url(#arrowhead-selected)',
    error: 'url(#arrowhead-error)',
  }
  return markers[props.type]
})

// Выбираем цвет линии в зависимости от типа
const strokeColor = computed(() => {
  const colors = {
    default: '#666',
    selected: '#007bff', 
    error: '#dc3545',
  }
  return colors[props.type]
})

// Вычисляем путь для линии с распределением точек
const pathData = computed(() => {
  const sourceNode = props.nodes.find(n => n.id === props.edge.sourceNodeId)
  const targetNode = props.nodes.find(n => n.id === props.edge.targetNodeId)
  
  if (!sourceNode || !targetNode) return ''
  
  // Точка выхода из исходного узла (правая сторона)
  const startX = sourceNode.position.x + sourceNode.width
  const startY = getConnectionY(
    sourceNode, 
    props.sourceConnectionsCount, 
    props.sourceConnectionIndex,
    'output'
  )
  
  // Точка входа в целевой узел (левая сторона)
  const endX = targetNode.position.x
  const endY = getConnectionY(
    targetNode,
    props.targetConnectionsCount,
    props.targetConnectionIndex,
    'input'
  )
  
  return `M ${startX} ${startY} L ${endX} ${endY}`
})

// Функция для вычисления Y-координаты соединения
function getConnectionY(
  node: Node, 
  connectionsCount: number, 
  connectionIndex: number,
  type: 'input' | 'output'
): number {
  if (connectionsCount <= 1) {
    // Если связь одна - середина стороны
    return node.position.y + node.height / 2
  }
  
  // Разделяем сторону на segmentsCount + 1 равных отрезков
  const segmentsCount = connectionsCount
  const segmentHeight = node.height / (segmentsCount + 1)
  
  // Вычисляем позицию (connectionIndex + 1) чтобы не касаться углов
  return node.position.y + segmentHeight * (connectionIndex + 1)
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
</style>