<template>
  <div class="left-panel">
    <div class="left-panel__tabs">
      <button
        type="button"
        class="left-panel__tab"
        :class="{ 'left-panel__tab--active': activeTab === 'code' }"
        @click="activeTab = 'code'"
      >
        Код
      </button>
      <button
        type="button"
        class="left-panel__tab"
        :class="{ 'left-panel__tab--active': activeTab === 'db' }"
        @click="activeTab = 'db'"
      >
        БД
      </button>
    </div>

    <CodeEditor
      v-show="activeTab === 'code'"
      :content="diagramJson"
      :error="jsonError"
      @update:content="documentStore.setJsonBuffer($event)"
      @focused="documentStore.setEditorFocused(true)"
      @blurred="documentStore.setEditorFocused(false)"
    />

    <DatabaseSchemaPane v-show="activeTab === 'db'" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useDiagramStore } from '@/domains/diagram'

import CodeEditor from './CodeEditor.vue'
import DatabaseSchemaPane from './DatabaseSchemaPane.vue'

const documentStore = useDiagramStore()
const activeTab = ref<'code' | 'db'>('code')

const {
  jsonError,
  jsonBuffer: diagramJson,
} = storeToRefs(documentStore)
</script>

<style scoped>
.left-panel {
  width: 400px;
  min-width: 300px;
  background: white;
  border-right: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.left-panel__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-bottom: 1px solid #dee2e6;
  background: #f8fafc;
}

.left-panel__tab {
  border: 0;
  background: transparent;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #475467;
  cursor: pointer;
}

.left-panel__tab--active {
  background: #ffffff;
  color: #111827;
  box-shadow: inset 0 -2px 0 #066664;
}

:deep(.code-editor-container) {
  flex: 1;
  min-height: 0;
}

@media (max-width: 768px) {
  .left-panel {
    width: 100%;
    height: 200px;
  }
}
</style>
