<template>
  <div class="controls-row">
    <UiInput
      :model-value="searchQuery"
      class="search-input"
      type="search"
      size="sm"
      block
      placeholder="Поиск"
      @update:model-value="emit('update:searchQuery', String($event))"
    />
    <UiSelect
      :model-value="sortBy"
      class="sort-select"
      size="sm"
      block
      @update:model-value="emit('update:sortBy', $event as 'name' | 'date')"
    >
      <option value="name">по названию</option>
      <option value="date">по дате</option>
    </UiSelect>
    <UiButton
      size="icon"
      variant="neutral"
      aria-label="Направление сортировки"
      @click="$emit('toggle-sort-direction')"
    >
      <ArrowUp v-if="sortDirection === 'asc'" :size="18" />
      <ArrowDown v-else :size="18" />
    </UiButton>
    <UiButton
      size="icon"
      variant="neutral"
      :active="showFavoritesOnly"
      aria-label="Только избранные"
      @click="$emit('toggle-favorites-filter')"
    >
      <Star :size="18" :fill="showFavoritesOnly ? 'currentColor' : 'none'" />
    </UiButton>
    <UiButton size="sm" variant="primary" class="create-btn" @click="$emit('create')">СОЗДАТЬ</UiButton>
  </div>
</template>

<script setup lang="ts">
import { ArrowDown, ArrowUp, Star } from 'lucide-vue-next'
import UiButton from '@/presentation/ui/UiButton.vue'
import UiInput from '@/presentation/ui/UiInput.vue'
import UiSelect from '@/presentation/ui/UiSelect.vue'

const props = defineProps<{
  searchQuery: string
  sortBy: 'name' | 'date'
  sortDirection: 'asc' | 'desc'
  showFavoritesOnly: boolean
}>()

const emit = defineEmits<{
  create: []
  'toggle-sort-direction': []
  'toggle-favorites-filter': []
  'update:searchQuery': [value: string]
  'update:sortBy': [value: 'name' | 'date']
}>()
</script>

<style scoped>
.controls-row {
  display: grid;
  grid-template-columns: 1fr 170px 38px 38px auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 22px;
}

:deep(.search-input),
:deep(.sort-select) {
  font-size: 16px;
}

.create-btn {
  justify-self: end;
  min-width: 96px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

:deep(.ui-button--neutral.ui-button--active) {
  background: #fff3ee;
  border-color: #f3c2ad;
  color: #ef7b4d;
  box-shadow: none;
}

@media (max-width: 700px) {
  .controls-row {
    grid-template-columns: 1fr 1fr 38px 38px;
  }

  .create-btn {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
</style>
