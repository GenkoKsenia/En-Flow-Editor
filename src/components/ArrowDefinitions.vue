<template>
  <svg class="arrow-definitions">
    <defs>
      <!-- Основная стрелка -->
      <marker
        id="arrowhead"
        markerWidth="14"
        markerHeight="10"
        refX="12"
        refY="5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="0 0, 14 5, 0 10" fill="context-stroke" />
      </marker>
      
      <!-- Выделенная стрелка -->
      <marker
        id="arrowhead-selected"
        markerWidth="14"
        markerHeight="10"
        refX="12"
        refY="5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="0 0, 14 5, 0 10" fill="context-stroke" />
      </marker>

      <!-- Ошибка стрелка -->
      <marker
        id="arrowhead-error"
        markerWidth="14"
        markerHeight="10"
        refX="12"
        refY="5"
        orient="auto"
        markerUnits="userSpaceOnUse"
      >
        <polygon points="0 0, 14 5, 0 10" fill="context-stroke" />
      </marker>
      
    </defs>
  </svg>
</template>

<script setup lang="ts">
// шаблон
</script>

<style scoped>
.arrow-definitions {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
</style>
