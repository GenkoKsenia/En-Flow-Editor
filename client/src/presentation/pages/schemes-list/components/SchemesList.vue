<template>
  <div class="cards-grid">
    <div v-if="isLoading" class="status-card">Загрузка схем...</div>
    <div v-else-if="errorMessage" class="status-card status-card_error">
      <span>{{ errorMessage }}</span>
      <button class="mini-btn" type="button" @click="$emit('retry')">Повторить</button>
    </div>
    <div v-else-if="schemes.length === 0" class="status-card">
      Схемы не найдены
    </div>
    <template v-else>
      <SchemeCardItem
        v-for="scheme in schemes"
        :key="scheme.id"
        :scheme="scheme"
        :is-editing="editingSchemeId === scheme.id"
        :rename-draft="renameDraft"
        :is-menu-open="openedMenuId === scheme.id"
        :is-delete-confirm-open="deletingSchemeId === scheme.id"
        :is-deleting="isDeleting"
        @open="$emit('open', $event)"
        @toggle-favorite="$emit('toggle-favorite', $event)"
        @toggle-menu="$emit('toggle-menu', $event)"
        @start-rename="$emit('start-rename', $event)"
        @update:renameDraft="$emit('update:renameDraft', $event)"
        @save-rename="$emit('save-rename', $event)"
        @cancel-rename="$emit('cancel-rename')"
        @start-delete-confirm="$emit('start-delete-confirm', $event)"
        @confirm-delete="$emit('confirm-delete', $event)"
        @cancel-delete="$emit('cancel-delete')"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SchemeCard } from '@/domains/schemes'

import SchemeCardItem from './SchemeCardItem.vue'

defineProps<{
  schemes: SchemeCard[]
  isLoading: boolean
  errorMessage: string
  editingSchemeId: string | null
  renameDraft: string
  openedMenuId: string | null
  deletingSchemeId: string | null
  isDeleting: boolean
}>()

defineEmits<{
  retry: []
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
</script>

<style scoped>
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, 400px);
  justify-content: center;
  gap: 20px;
}

.status-card {
  width: min(100%, 400px);
  min-height: 120px;
  margin: 0 auto;
  border: 1px solid #cfd4dc;
  border-radius: 4px;
  background: #fff;
  color: #4e5460;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 16px;
  text-align: center;
}

.status-card_error {
  border-color: #e0b4b0;
  color: #8f2f28;
}

.mini-btn {
  border: 1px solid #d1d6de;
  background: #fff;
  color: #4e5460;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

@media (max-width: 1024px) {
  .cards-grid {
    grid-template-columns: 400px;
  }
}

@media (max-width: 700px) {
  .cards-grid {
    grid-template-columns: minmax(280px, 1fr);
  }
}
</style>
