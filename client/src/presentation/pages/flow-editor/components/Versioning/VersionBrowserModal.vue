<template>
  <BaseModal :open="true" title="Версии схемы" width="960px" @close="$emit('close')">
    <div class="versions-browser">
      <div class="versions-browser__filters">
        <label class="versions-browser__field">
          <span>С</span>
          <input
            :value="from"
            type="datetime-local"
            class="versions-browser__input"
            @input="$emit('update:from', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="versions-browser__field">
          <span>По</span>
          <input
            :value="to"
            type="datetime-local"
            class="versions-browser__input"
            @input="$emit('update:to', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <UiButton :disabled="loading" @click="$emit('submit')">
          {{ loading ? 'Загрузка...' : 'Показать версии' }}
        </UiButton>
      </div>

      <div v-if="error" class="versions-browser__error">{{ error }}</div>

      <div v-if="hasRequested" class="versions-browser__results">
        <div class="versions-browser__results-header">
          <span>Найдено версий: {{ versions.length }}</span>
        </div>

        <div v-if="versions.length" class="versions-browser__list">
          <button
            v-for="version in versions"
            :key="version.id"
            type="button"
            class="version-row"
            @click="$emit('open-version', version.id)"
          >
            <div class="version-row__main">
              <div class="version-row__title">{{ formatVersionDate(version.date) }}</div>
              <div class="version-row__meta">
                <span>ID: {{ version.id }}</span>
              </div>
            </div>
            <span class="version-row__action">Сравнить</span>
          </button>
        </div>

        <div v-else class="versions-browser__empty">
          За выбранный период версии не найдены.
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from '@/presentation/ui/BaseModal.vue'
import UiButton from '@/presentation/ui/UiButton.vue'
import type { SchemeVersion } from '@/domains/schemes'

defineProps<{
  from: string
  to: string
  versions: SchemeVersion[]
  loading: boolean
  error: string | null
  hasRequested: boolean
}>()

defineEmits<{
  close: []
  submit: []
  'update:from': [value: string]
  'update:to': [value: string]
  'open-version': [versionId: string]
}>()

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatVersionDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
</script>

<style scoped>
.versions-browser {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.versions-browser__filters {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.versions-browser__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #2f3440;
}

.versions-browser__input {
  min-height: 38px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 0 12px;
  font-size: 14px;
  color: #2f3440;
}

.versions-browser__input:focus {
  outline: none;
  border-color: #066664;
  box-shadow: 0 0 0 3px rgba(6, 102, 100, 0.12);
}

.versions-browser__error {
  border: 1px solid rgba(217, 72, 95, 0.24);
  border-radius: 8px;
  background: rgba(217, 72, 95, 0.08);
  color: #b42318;
  padding: 12px;
  font-size: 14px;
}

.versions-browser__results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.versions-browser__results-header {
  font-size: 13px;
  font-weight: 600;
  color: #495057;
}

.versions-browser__list {
  max-height: 420px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.version-row {
  width: 100%;
  border: 1px solid #d8dee7;
  border-radius: 8px;
  background: #ffffff;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;
}

.version-row:hover {
  border-color: #0b6bcb;
  box-shadow: 0 0 0 3px rgba(11, 107, 203, 0.08);
}

.version-row__main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.version-row__title {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
}

.version-row__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #6b7280;
}

.version-row__action {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 700;
  color: #0b6bcb;
}

.versions-browser__empty {
  border: 1px dashed #d1d5db;
  border-radius: 8px;
  padding: 18px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
}

@media (max-width: 768px) {
  .versions-browser__filters {
    grid-template-columns: 1fr;
  }

  .version-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
