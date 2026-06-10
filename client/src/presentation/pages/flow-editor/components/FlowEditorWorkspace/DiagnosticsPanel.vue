<template>
  <div v-if="diagnostics.length" class="diagnostics-panel">
    <div class="diagnostics-header">
      <div class="diagnostics-header-top">
        <h3>Проблемы схемы</h3>
        <button
          type="button"
          class="collapse-btn"
          aria-label="Свернуть панель ошибок"
          title="Свернуть панель ошибок"
          @click="$emit('toggle-collapse')"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M3 8h10"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-width="1.8"
            />
          </svg>
        </button>
      </div>
      <div class="diagnostics-summary">
        <span v-if="errorCount" class="summary-badge summary-badge--error">Ошибки: {{ errorCount }}</span>
        <span v-if="warningCount" class="summary-badge summary-badge--warning">Предупреждения: {{ warningCount }}</span>
      </div>
    </div>

    <div class="diagnostics-list">
      <article
        v-for="diagnostic in diagnostics"
        :key="diagnostic.id"
        class="diagnostic-card"
        :class="`diagnostic-card--${diagnostic.level}`"
      >
        <div class="diagnostic-card-meta">
          <span class="diagnostic-level">
            {{ diagnostic.level === 'error' ? 'Ошибка' : 'Предупреждение' }}
          </span>
          <span class="diagnostic-target">{{ diagnostic.targetDisplay }}</span>
        </div>
        <div class="diagnostic-message">{{ diagnostic.message }}</div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { SchemeDiagnosticItem } from '../../composables/useEditorDiagnostics'

interface Props {
  diagnostics: SchemeDiagnosticItem[]
}

const props = defineProps<Props>()
defineEmits<{
  'toggle-collapse': []
}>()

const errorCount = computed(() => props.diagnostics.filter(item => item.level === 'error').length)
const warningCount = computed(() => props.diagnostics.filter(item => item.level === 'warning').length)
</script>

<style scoped>
.diagnostics-panel {
  width: 100%;
  height: 100%;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.diagnostics-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.diagnostics-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.diagnostics-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #212529;
}

.collapse-btn {
  border: 1px solid #d0d7de;
  border-radius: 999px;
  background: #ffffff;
  color: #495057;
  width: 32px;
  height: 32px;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.collapse-btn:hover {
  border-color: #0b6bcb;
  color: #0b6bcb;
}

.collapse-btn svg {
  width: 16px;
  height: 16px;
}

.diagnostics-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.summary-badge--error {
  background: #fdeaea;
  color: #b42318;
}

.summary-badge--warning {
  background: #fff4e5;
  color: #8a4b00;
}

.diagnostics-list {
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.diagnostic-card {
  border: 1px solid #e6e8eb;
  border-left-width: 4px;
  border-radius: 8px;
  padding: 12px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.diagnostic-card--error {
  border-left-color: #dc3545;
  background: #fff7f7;
}

.diagnostic-card--warning {
  border-left-color: #f59f00;
  background: #fffaf0;
}

.diagnostic-card-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.diagnostic-level {
  font-size: 12px;
  font-weight: 700;
  color: #495057;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.diagnostic-target {
  font-size: 13px;
  font-weight: 600;
  color: #212529;
}

.diagnostic-message {
  font-size: 13px;
  line-height: 1.45;
  color: #495057;
}
</style>
