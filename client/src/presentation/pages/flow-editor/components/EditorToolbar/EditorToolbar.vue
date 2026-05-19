<template>
  <div class="toolbar">
    <div class="toolbar-group icon-group">
      <UiButton size="icon" variant="outline" :disabled="isReadOnly" @click="$emit('add-node')" title="Процесс" aria-label="Процесс">
        <Square class="toolbar-icon" />
      </UiButton>
      <UiButton
        size="icon"
        variant="outline"
        :active="isConnectionMode"
        :disabled="isReadOnly"
        @click="$emit('start-connection-mode')"
        title="Поток данных"
        aria-label="Связь"
      >
        <GitBranch class="toolbar-icon" />
      </UiButton>
      <UiButton size="icon" variant="outline" title="Внешняя система" aria-label="Внешняя система">
        <Globe class="toolbar-icon" />
      </UiButton>
      <UiButton size="icon" variant="outline" title="Пользователь" aria-label="Пользователь">
        <UserRound class="toolbar-icon" />
      </UiButton>
      <UiButton size="icon" variant="outline" :disabled="isReadOnly" @click="$emit('add-database-node')" title="Хранилище данных" aria-label="Хранилище данных">
        <Database class="toolbar-icon" />
      </UiButton>
      <UiButton
        size="icon"
        variant="outline"
        :active="isCommentMode"
        @click="$emit('toggle-comment-mode')"
        title="Комментарий"
        aria-label="Комментарий"
      >
        <MessageSquare class="toolbar-icon" />
      </UiButton>
      <UiButton size="icon" variant="outline" :disabled="isReadOnly" @click="$emit('add-boundary')" title="Граница системы" aria-label="Граница системы">
        <SquareDashed class="toolbar-icon" />
      </UiButton>
    </div>

    <div class="toolbar-right">
      <UiButton
        class="comments-visibility-button"
        variant="neutral"
        pill
        :active="!isCommentsVisible"
        @click="$emit('toggle-comments-visibility')"
        :aria-label="isCommentsVisible ? 'Скрыть комментарии' : 'Показать комментарии'"
      >
        <component :is="isCommentsVisible ? EyeOff : Eye" :size="16" />
        <span class="team-label">{{ isCommentsVisible ? 'Скрыть комментарии' : 'Показать комментарии' }}</span>
      </UiButton>

      <UiButton variant="neutral" pill @click="$emit('open-team-modal')" aria-label="Команда">
        <span class="team-avatars">
          <span class="avatar-circle">OP</span>
          <span class="avatar-circle">OP</span>
          <span class="avatar-circle">OP</span>
        </span>
        <span class="team-label">Команда</span>
      </UiButton>

      <div class="version-wrap" ref="versionMenuRef">
        <UiButton class="version-button" variant="neutral" pill @click.stop="$emit('toggle-version-menu')" aria-label="Версии">
          <History :size="16" />
          <span class="team-label">Версии</span>
        </UiButton>
      </div>

      <div class="download-wrap" ref="downloadMenuRef">
        <UiButton class="download-toggle" variant="primary" @click.stop="$emit('toggle-download-menu')">
          Скачать
        </UiButton>
        <div v-if="isDownloadMenuOpen" class="download-menu" @click.stop>
          <JsonExportButton
            :nodes="nodes"
            :edges="edges"
            :data-flows="dataFlows"
            :comments="comments"
            label="JSON"
            @exported="$emit('close-download-menu')"
          />
          <UiButton block size="sm" variant="outline" @click="$emit('download-png')">PNG</UiButton>
          <label class="download-checkbox" @click.stop>
            <input
              type="checkbox"
              :checked="includeCommentsInPng"
              @change="$emit('update:include-comments-in-png', ($event.target as HTMLInputElement).checked)"
            />
            <span>Сохранять PNG с комментариями</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Database, Eye, EyeOff, GitBranch, Globe, History, MessageSquare, Square, SquareDashed, UserRound } from 'lucide-vue-next'

import type { CommentsStoreComment } from '@/domains/comments'
import UiButton from '@/presentation/ui/UiButton.vue'
import JsonExportButton from './JsonExportButton.vue'
import type { VersionRecord } from '@/domains/diagram'
import type { DataFlow, Edge, Node } from '@/domains/graph'

defineProps<{
  isConnectionMode: boolean
  isCommentMode: boolean
  isCommentsVisible: boolean
  isDownloadMenuOpen: boolean
  isVersionMenuOpen: boolean
  currentVersionLabel: string
  versionHistory: VersionRecord[]
  nodes: Node[]
  edges: Edge[]
  dataFlows: DataFlow[]
  comments: CommentsStoreComment[]
  includeCommentsInPng: boolean
  isReadOnly: boolean
}>()

const emit = defineEmits<{
  'add-node': []
  'add-database-node': []
  'start-connection-mode': []
  'toggle-comment-mode': []
  'toggle-comments-visibility': []
  'add-boundary': []
  'open-team-modal': []
  'toggle-version-menu': []
  'toggle-download-menu': []
  'close-download-menu': []
  'close-version-menu': []
  'update:include-comments-in-png': [value: boolean]
  'download-png': []
}>()

const downloadMenuRef = ref<HTMLElement | null>(null)
const versionMenuRef = ref<HTMLElement | null>(null)

function onDocumentMouseDown(event: MouseEvent): void {
  const target = event.target as globalThis.Node | null

  if (downloadMenuRef.value && target && !downloadMenuRef.value.contains(target)) {
    emit('close-download-menu')
  }

}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown)
})
</script>

<style scoped>
.toolbar {
  padding: 12px 20px;
  background: #ebebeb;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.comments-visibility-button {
  gap: 8px;
}

.icon-group {
  gap: 6px;
}

.toolbar-icon {
  width: 20px !important;
  height: 20px !important;
  min-width: 20px;
  min-height: 20px;
  flex: 0 0 20px;
  display: block;
  stroke-width: 2;
}

.team-avatars {
  display: inline-flex;
  margin-right: 8px;
}

.avatar-circle {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #dbe4ff;
  color: #1d4ed8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  border: 2px solid #fff;
}

.avatar-circle + .avatar-circle {
  margin-left: -6px;
}

.team-label {
  font-size: 13px;
}

.version-wrap,
.download-wrap {
  position: relative;
}

.version-button {
  gap: 8px;
}

.version-menu,
.download-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 240px;
  border: 1px solid #d8dce3;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
  padding: 6px;
  z-index: 12001;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

:deep(.version-current-input) {
  font-size: 13px;
}

.version-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow: auto;
}

.version-item {
  min-height: 44px;
}

.version-item-meta {
  text-align: left;
}

.version-item-title {
  font-size: 13px;
  font-weight: 600;
}

.version-item-date {
  font-size: 12px;
  color: #6c757d;
}

.download-toggle {
  min-width: 98px;
}

.download-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 6px;
  font-size: 12px;
  color: #495057;
  cursor: pointer;
  user-select: none;
}

.download-checkbox input {
  margin: 1px 0 0;
  accent-color: #066664;
}
</style>
