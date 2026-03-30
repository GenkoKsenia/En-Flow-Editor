<template>
  <div class="toolbar">
    <div class="toolbar-group icon-group">
      <UiButton size="icon" variant="outline" @click="$emit('add-node')" title="Процесс" aria-label="Процесс">
        <Square class="toolbar-icon" />
      </UiButton>
      <UiButton
        size="icon"
        variant="outline"
        :active="isConnectionMode"
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
      <UiButton size="icon" variant="outline" title="Хранилище данных" aria-label="Хранилище данных">
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
      <UiButton size="icon" variant="outline" @click="$emit('add-boundary')" title="Граница системы" aria-label="Граница системы">
        <SquareDashed class="toolbar-icon" />
      </UiButton>
    </div>

    <div class="toolbar-right">
      <div class="stats">
        Узлов: {{ nodesCount }}
        <span v-if="edgesCount">, Связей: {{ edgesCount }}</span>
      </div>

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
        <div v-if="isVersionMenuOpen" class="version-menu" @click.stop>
          <UiInput
            :model-value="currentVersionLabel"
            class="version-current-input"
            size="sm"
            block
            @update:model-value="$emit('update:current-version-label', String($event))"
          />
          <UiButton block size="sm" variant="outline" @click="$emit('pin-current-version')">Зафиксировать версию</UiButton>
          <div class="version-list">
            <UiButton
              v-for="version in versionHistory"
              :key="version.id"
              class="version-item"
              block
              variant="surface"
              align="start"
              @click="$emit('open-version', version.id)"
            >
              <div class="version-item-meta">
                <div class="version-item-title">{{ version.label }}</div>
                <div class="version-item-date">{{ version.date }}</div>
              </div>
            </UiButton>
          </div>
        </div>
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Database, GitBranch, Globe, History, MessageSquare, Square, SquareDashed, UserRound } from 'lucide-vue-next'

import type { CommentsStoreComment } from '@/domains/comments'
import UiButton from '@/presentation/ui/UiButton.vue'
import UiInput from '@/presentation/ui/UiInput.vue'
import JsonExportButton from './JsonExportButton.vue'
import type { VersionRecord } from '@/domains/diagram'
import type { DataFlow, Edge, Node } from '@/domains/graph'

defineProps<{
  nodesCount: number
  edgesCount: number
  isConnectionMode: boolean
  isCommentMode: boolean
  isDownloadMenuOpen: boolean
  isVersionMenuOpen: boolean
  currentVersionLabel: string
  versionHistory: VersionRecord[]
  nodes: Node[]
  edges: Edge[]
  dataFlows: DataFlow[]
  comments: CommentsStoreComment[]
}>()

const emit = defineEmits<{
  'add-node': []
  'start-connection-mode': []
  'toggle-comment-mode': []
  'add-boundary': []
  'open-team-modal': []
  'toggle-version-menu': []
  'pin-current-version': []
  'open-version': [versionId: string]
  'update:current-version-label': [value: string]
  'toggle-download-menu': []
  'close-download-menu': []
  'close-version-menu': []
  'download-png': []
}>()

const downloadMenuRef = ref<HTMLElement | null>(null)
const versionMenuRef = ref<HTMLElement | null>(null)

function onDocumentMouseDown(event: MouseEvent): void {
  const target = event.target as globalThis.Node | null

  if (downloadMenuRef.value && target && !downloadMenuRef.value.contains(target)) {
    emit('close-download-menu')
  }

  if (versionMenuRef.value && target && !versionMenuRef.value.contains(target)) {
    emit('close-version-menu')
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

.stats {
  font-size: 14px;
  color: #495057;
}

.team-avatars {
  display: inline-flex;
  margin-right: 8px;
}

.avatar-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
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
  border-radius: 6px;
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
</style>
