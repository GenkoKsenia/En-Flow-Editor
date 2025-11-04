<template>
  <div
    class="node"
    :style="nodeStyle"
    :class="{
      selected: selected,
      'connection-source': isConnectionSource,
      'connection-target': isConnectionTarget,
      dragging: isDragging
    }"
    @mousedown="onMouseDown"
    @click="onClick"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    {{ node.text }}

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
import type { Node, ConnectionSide } from '../types'

interface Props {
  node: Node
  selected?: boolean
  isConnectionSource?: boolean
  isConnectionTarget?: boolean
  isDragging?: boolean
  showConnectionHints?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  isConnectionSource: false,
  isConnectionTarget: false,
  isDragging: false,
  showConnectionHints: false
})

const emit = defineEmits<{
  'node-mousedown': [nodeId: string, event: MouseEvent]
  'node-click': [nodeId: string, event: MouseEvent]
  'node-hover-side': [nodeId: string, side: ConnectionSide | null]
}>()

const hoveredSide = ref<ConnectionSide | null>(null)

const nodeStyle = computed(() => ({
  left: `${props.node.position.x}px`,
  top: `${props.node.position.y}px`,
  width: `${props.node.width}px`,
  height: `${props.node.height}px`,
  transform: props.isDragging ? 'translate(var(--drag-dx), var(--drag-dy))' : 'none'
}))

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
  const threshold = 15; // Уменьшим порог для более точного определения
  
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
  border: 2px solid #4CAF50;
  border-radius: 8px;
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

.node:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.node.selected {
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
}

.node.connection-source {
  border-color: #28a745;
  box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.25);
}

.node.connection-target {
  border-color: #ffc107;
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
</style>