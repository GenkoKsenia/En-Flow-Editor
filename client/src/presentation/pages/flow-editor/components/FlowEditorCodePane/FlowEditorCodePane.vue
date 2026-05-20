<template>
  <div
    ref="panelRef"
    class="left-panel"
    :class="{ 'left-panel--resizing': isResizing }"
    :style="panelStyle"
  >
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
      :content="diagramDsl"
      :error="dslError"
      :read-only="documentStore.isReadOnly"
      @update:content="documentStore.setDslBuffer($event)"
      @focused="documentStore.setEditorFocused(true)"
      @blurred="documentStore.setEditorFocused(false)"
    />

    <DatabaseSchemaPane v-show="activeTab === 'db'" :read-only="documentStore.isReadOnly" />

    <button
      v-if="isDesktop"
      type="button"
      class="left-panel__resize-handle"
      aria-label="Изменить ширину панели кода"
      @mousedown.prevent="startResize"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'

import { useDiagramStore } from '@/domains/diagram'

import CodeEditor from './CodeEditor.vue'
import DatabaseSchemaPane from './DatabaseSchemaPane.vue'

const DEFAULT_PANEL_WIDTH = 400
const MOBILE_BREAKPOINT = 768

const documentStore = useDiagramStore()
const activeTab = ref<'code' | 'db'>('code')
const panelRef = ref<HTMLElement | null>(null)
const panelWidth = ref(DEFAULT_PANEL_WIDTH)
const isResizing = ref(false)
const viewportWidth = ref(typeof window === 'undefined' ? 1280 : window.innerWidth)

const {
  dslError,
  dslBuffer: diagramDsl,
} = storeToRefs(documentStore)

const isDesktop = computed(() => viewportWidth.value > MOBILE_BREAKPOINT)
const panelStyle = computed(() => (
  isDesktop.value
    ? { width: `${panelWidth.value}px`, minWidth: `${DEFAULT_PANEL_WIDTH}px` }
    : undefined
))

function updateViewportWidth(): void {
  viewportWidth.value = window.innerWidth

  if (!isDesktop.value) {
    stopResize()
    return
  }

  const maxWidth = getMaxPanelWidth()
  if (panelWidth.value > maxWidth) {
    panelWidth.value = maxWidth
  }
}

function getMaxPanelWidth(): number {
  const parentWidth = panelRef.value?.parentElement?.clientWidth ?? viewportWidth.value
  return Math.max(DEFAULT_PANEL_WIDTH, Math.floor(parentWidth / 2))
}

function clampPanelWidth(nextWidth: number): number {
  return Math.min(getMaxPanelWidth(), Math.max(DEFAULT_PANEL_WIDTH, nextWidth))
}

function onResizeMouseMove(event: MouseEvent): void {
  if (!isResizing.value) return
  panelWidth.value = clampPanelWidth(event.clientX)
}

function stopResize(): void {
  if (!isResizing.value) return

  isResizing.value = false
  document.body.classList.remove('flow-editor-resize-active')
  document.removeEventListener('mousemove', onResizeMouseMove)
  document.removeEventListener('mouseup', stopResize)
}

function startResize(): void {
  if (!isDesktop.value) return

  isResizing.value = true
  document.body.classList.add('flow-editor-resize-active')
  document.addEventListener('mousemove', onResizeMouseMove)
  document.addEventListener('mouseup', stopResize)
}

onMounted(() => {
  window.addEventListener('resize', updateViewportWidth)
})

onBeforeUnmount(() => {
  stopResize()
  window.removeEventListener('resize', updateViewportWidth)
})
</script>

<style scoped>
.left-panel {
  position: relative;
  width: 400px;
  min-width: 400px;
  background: white;
  border-right: 1px solid #dee2e6;
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 0;
}

.left-panel--resizing {
  user-select: none;
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

.left-panel__resize-handle {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
  z-index: 5;
}

.left-panel__resize-handle::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: transparent;
  transition: background-color 0.15s ease;
}

.left-panel__resize-handle:hover::before,
.left-panel--resizing .left-panel__resize-handle::before {
  background: #066664;
}

body:global(.flow-editor-resize-active) {
  cursor: col-resize;
  user-select: none;
}

@media (max-width: 768px) {
  .left-panel {
    width: 100%;
    min-width: 100%;
    height: 200px;
  }
}
</style>
