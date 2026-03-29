<template>
  <div class="left-panel">
    <div class="code-actions">
      <UiButton variant="primary" @click="onSetCode">Отправить псевдокод</UiButton>
      <UiButton variant="primary" @click="onGetCode">Получить псевдокод</UiButton>
    </div>

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

import UiButton from '@/presentation/ui/UiButton.vue'
import { useEditorDocumentStore } from '@/domains/editor-document'

import CodeEditor from './CodeEditor.vue'

const documentStore = useEditorDocumentStore()

const {
  jsonError,
  jsonBuffer: diagramJson,
} = storeToRefs(documentStore)

async function onSetCode(): Promise<void> {
  await documentStore.saveCurrentVersion()
}

async function onGetCode(): Promise<void> {
  await documentStore.loadSchemeSnapshot(documentStore.schemeId)
}
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

.code-actions {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  align-items: center;
  flex-wrap: nowrap;
}

:deep(.code-actions .ui-button) {
  white-space: nowrap;
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
