<template>
  <div
    class="node"
    :style="nodeStyle"
    @mousedown="onMouseDown"
  >
    {{ node.text }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Node } from '../types'

interface Props {
  node: Node
}

const props = defineProps<Props>()

// Определяем события которые компонент может emit'ить
const emit = defineEmits<{
  'node-mousedown': [nodeId: string, event: MouseEvent]
}>()

// Вычисляемые стили для узла
const nodeStyle = computed(() => ({
  left: `${props.node.position.x}px`,
  top: `${props.node.position.y}px`,
  width: `${props.node.width}px`,
  height: `${props.node.height}px`,
}))

// Обработчик нажатия мыши на узле
function onMouseDown(event: MouseEvent) {
  // "Выбрасываем" событие для родительского компонента
  emit('node-mousedown', props.node.id, event)
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
}

.node:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.node:active {
  cursor: grabbing;
}
</style>