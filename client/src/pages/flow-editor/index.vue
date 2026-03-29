<template>
  <div class="flow-editor">
    <div class="editor-layout">
      <FlowEditorCodePane />
      <FlowEditorWorkspace />
    </div>

    <TeamModal />
  </div>
</template>

<script setup lang="ts">
import FlowEditorCodePane from './components/FlowEditorCodePane/FlowEditorCodePane.vue'
import FlowEditorWorkspace from './components/FlowEditorWorkspace/FlowEditorWorkspace.vue'
import TeamModal from './components/TeamModal/TeamModal.vue'
import { useFlowEditorRoute } from './composables/useFlowEditorRoute'

useFlowEditorRoute()
</script>

<style scoped>
.flow-editor {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.editor-layout {
  flex: 1;
  display: flex;
  height: 100%;
  width: 100%;
}

@media (max-width: 768px) {
  .editor-layout {
    flex-direction: column;
  }
}
</style>
