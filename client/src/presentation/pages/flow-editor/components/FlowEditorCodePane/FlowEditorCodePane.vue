<template>
  <div class="left-panel">
    <CodeEditor
      :content="diagramJson"
      :error="jsonError"
      @update:content="documentStore.setJsonBuffer($event)"
      @focused="documentStore.setEditorFocused(true)"
      @blurred="documentStore.setEditorFocused(false)"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { useDiagramStore } from '@/domains/diagram'

import CodeEditor from './CodeEditor.vue'

const documentStore = useDiagramStore()

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
