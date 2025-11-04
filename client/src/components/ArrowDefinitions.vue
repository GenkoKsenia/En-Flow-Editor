<template>
  <svg class="arrow-definitions">
    <defs>
      <!-- Основная стрелка -->
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
      </marker>
      
      <!-- Выделенная стрелка -->
      <marker
        id="arrowhead-selected"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="#007bff" />
      </marker>

      <!-- Ошибка стрелка -->
      <marker
        id="arrowhead-error"
        markerWidth="10"
        markerHeight="7"
        refX="9"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="#dc3545" />
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