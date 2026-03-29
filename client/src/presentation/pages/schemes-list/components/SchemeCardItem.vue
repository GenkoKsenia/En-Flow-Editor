<template>
  <article class="scheme-card" @click="$emit('open', scheme.id)">
    <button
      class="star-btn"
      :class="{ active: scheme.favorite }"
      type="button"
      aria-label="Избранное"
      @click.stop="$emit('toggle-favorite', scheme.id)"
    >
      <Star :size="16" :fill="scheme.favorite ? 'currentColor' : 'none'" />
    </button>

    <div class="preview">
      <div class="preview-placeholder">Превью схемы</div>
    </div>

    <div class="card-footer">
      <template v-if="isEditing">
        <div class="rename-inline" @click.stop>
          <UiInput
            :model-value="renameDraft"
            type="text"
            size="sm"
            block
            maxlength="120"
            @update:model-value="$emit('update:renameDraft', String($event))"
            @keydown.enter.stop.prevent="$emit('save-rename', scheme.id)"
            @keydown.esc.stop.prevent="$emit('cancel-rename')"
          />
          <div class="rename-actions">
            <UiButton
              size="sm"
              variant="outline"
              :disabled="!renameDraft.trim()"
              @click.stop="$emit('save-rename', scheme.id)"
            >
              Сохранить
            </UiButton>
            <UiButton size="sm" variant="neutral" @click.stop="$emit('cancel-rename')">Отмена</UiButton>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="meta">
          <div class="name">{{ scheme.name }}</div>
          <div class="time">Изменено {{ formatUpdatedAt(scheme.updatedAt) }}</div>
        </div>

        <div class="menu-wrap">
          <button
            class="menu-btn"
            type="button"
            aria-label="Меню"
            @click.stop="$emit('toggle-menu', scheme.id)"
          >
            <Ellipsis :size="16" />
          </button>
          <div v-if="isMenuOpen" class="menu-dropdown" @click.stop>
            <button class="menu-item" type="button" @click.stop="$emit('start-rename', scheme.id)">
              <Pencil :size="14" />
              <span>Переименовать</span>
            </button>
            <button class="menu-item delete" type="button" @click.stop="$emit('start-delete-confirm', scheme.id)">
              <Trash2 :size="14" />
              <span>Удалить</span>
            </button>
          </div>
          <div v-if="isDeleteConfirmOpen" class="delete-confirm" @click.stop>
            <div class="delete-confirm-text">Удалить схему?</div>
            <div class="delete-confirm-actions">
              <UiButton
                size="sm"
                variant="danger-outline"
                :disabled="isDeleting"
                @click.stop="$emit('confirm-delete', scheme.id)"
              >
                {{ isDeleting ? 'Удаление...' : 'Удалить' }}
              </UiButton>
              <UiButton
                size="sm"
                variant="neutral"
                :disabled="isDeleting"
                @click.stop="$emit('cancel-delete')"
              >
                Отмена
              </UiButton>
            </div>
          </div>
        </div>
      </template>
    </div>
  </article>
</template>

<script setup lang="ts">
import { Ellipsis, Pencil, Star, Trash2 } from 'lucide-vue-next'

import UiButton from '@/presentation/ui/UiButton.vue'
import UiInput from '@/presentation/ui/UiInput.vue'
import type { SchemeCard } from '@/domains/schemes'

defineProps<{
  scheme: SchemeCard
  isEditing: boolean
  renameDraft: string
  isMenuOpen: boolean
  isDeleteConfirmOpen: boolean
  isDeleting: boolean
}>()

const emit = defineEmits<{
  open: [schemeId: string]
  'toggle-favorite': [schemeId: string]
  'toggle-menu': [schemeId: string]
  'start-rename': [schemeId: string]
  'update:renameDraft': [value: string]
  'save-rename': [schemeId: string]
  'cancel-rename': []
  'start-delete-confirm': [schemeId: string]
  'confirm-delete': [schemeId: string]
  'cancel-delete': []
}>()

function formatUpdatedAt(isoDate: string | null): string {
  if (!isoDate) return '-'

  const timestamp = new Date(isoDate).getTime()
  if (Number.isNaN(timestamp)) return '-'

  const diffMs = timestamp - Date.now()
  const absDiff = Math.abs(diffMs)
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs
  const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'always' })

  if (absDiff < hourMs) return rtf.format(Math.round(diffMs / minuteMs), 'minute')
  if (absDiff < dayMs) return rtf.format(Math.round(diffMs / hourMs), 'hour')
  return rtf.format(Math.round(diffMs / dayMs), 'day')
}
</script>

<style scoped>
.scheme-card {
  position: relative;
  width: 400px;
  height: 240px;
  background: #fff;
  border: 1px solid #bdc1ca;
  border-radius: 4px;
  overflow: visible;
  cursor: pointer;
  display: flex;
  flex-direction: column;
}

.star-btn {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  border: 1px solid #c8ccd4;
  border-radius: 3px;
  background: #fff;
  color: #8b8f97;
  line-height: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.star-btn.active {
  color: #ef7b4d;
}

.preview {
  flex: 1;
  border-bottom: 1px solid #d8dbe2;
  background: #f8f9fb;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-placeholder {
  font-size: 12px;
  color: #8a909b;
}

.card-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 6px 6px;
}

.rename-inline {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rename-actions {
  display: flex;
  gap: 6px;
}

.meta {
  min-width: 0;
}

.name {
  font-size: 14px;
  color: #333840;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time {
  margin-top: 2px;
  font-size: 11px;
  color: #8c9099;
}

.menu-wrap {
  position: relative;
}

.menu-btn {
  border: none;
  background: transparent;
  color: #848892;
  width: 24px;
  height: 24px;
  cursor: pointer;
  line-height: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.menu-dropdown {
  position: absolute;
  top: 24px;
  right: 0;
  width: 150px;
  border-radius: 4px;
  border: 1px solid #d9dce3;
  background: #fff;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.14);
  overflow: hidden;
  z-index: 10;
}

.delete-confirm {
  position: absolute;
  top: 24px;
  right: 0;
  width: 170px;
  border-radius: 4px;
  border: 1px solid #d9dce3;
  background: #fff;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.14);
  padding: 8px;
  z-index: 11;
}

.delete-confirm-text {
  font-size: 12px;
  color: #39414d;
  margin-bottom: 8px;
}

.delete-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.menu-item {
  width: 100%;
  border: none;
  background: #fff;
  text-align: left;
  padding: 8px 10px;
  font-size: 13px;
  color: #343942;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-item:hover {
  background: #f2f4f8;
}

.menu-item.delete {
  color: #b43b33;
}

@media (max-width: 700px) {
  .scheme-card {
    width: 100%;
    max-width: 400px;
  }
}
</style>
