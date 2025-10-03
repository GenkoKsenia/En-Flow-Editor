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
  type?: 'default' | 'selected' | 'error' //тип стрелки
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default'  // по умолчанию обычная стрелка
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
    default: '#666',        // серый
    selected: '#007bff',    // синий
    error: '#dc3545',       // красный
  }
  return colors[props.type]
})

const pathData = computed(() => {
  const sourceNode = props.nodes.find(n => n.id === props.edge.sourceNodeId)
  const targetNode = props.nodes.find(n => n.id === props.edge.targetNodeId)
  
  if (!sourceNode || !targetNode) return ''
  
  const startX = sourceNode.position.x + sourceNode.width
  const startY = sourceNode.position.y + sourceNode.height / 2
  const endX = targetNode.position.x
  const endY = targetNode.position.y + targetNode.height / 2
  
  return `M ${startX} ${startY} L ${endX} ${endY}`
})
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