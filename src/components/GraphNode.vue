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
  >
    {{ node.text }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Node } from '../types'

interface Props {
  node: Node
  selected?: boolean
  isConnectionSource?: boolean
  isConnectionTarget?: boolean
  isDragging?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  isConnectionSource: false,
  isConnectionTarget: false,
  isDragging: false
})

const emit = defineEmits<{
  'node-mousedown': [nodeId: string, event: MouseEvent]
  'node-click': [nodeId: string, event: MouseEvent]
}>()

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
</script>

<style scoped>
.node {
  position: absolute;
  background: white;
  border: 2px solid #4CAF50;
  border-radius: 8px;
  padding: 10px;
  cursor: grab;
  user-select: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 14px;
  transition: box-shadow 0.2s ease;
  /* Отключаем transition для transform чтобы не было лагов */
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
</style>