<template>
  <div class="controls-row">
    <input
      :value="searchQuery"
      class="search-input"
      type="search"
      placeholder="Поиск"
      @input="onSearchInput"
    />
    <select :value="sortBy" class="sort-select" @change="onSortChange">
      <option value="name">по названию</option>
      <option value="date">по дате</option>
    </select>
    <button
      class="icon-btn"
      type="button"
      aria-label="Направление сортировки"
      @click="$emit('toggle-sort-direction')"
    >
      <ArrowUp v-if="sortDirection === 'asc'" :size="18" />
      <ArrowDown v-else :size="18" />
    </button>
    <button
      class="icon-btn"
      :class="{ active: showFavoritesOnly }"
      type="button"
      aria-label="Только избранные"
      @click="$emit('toggle-favorites-filter')"
    >
      <Star :size="18" :fill="showFavoritesOnly ? 'currentColor' : 'none'" />
    </button>
    <button class="create-btn" type="button" @click="$emit('create')">СОЗДАТЬ</button>
  </div>
</template>

<script setup lang="ts">
import { ArrowDown, ArrowUp, Star } from 'lucide-vue-next'

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

function onSearchInput(event: Event): void {
  emit('update:searchQuery', (event.target as HTMLInputElement).value)
}

function onSortChange(event: Event): void {
  emit('update:sortBy', (event.target as HTMLSelectElement).value as 'name' | 'date')
}
</script>

<style scoped>
.controls-row {
  display: grid;
  grid-template-columns: 1fr 170px 38px 38px auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 22px;
}

.search-input,
.sort-select {
  height: 34px;
  border: 1px solid #d4d6dc;
  border-radius: 4px;
  background: #fff;
  color: #53565f;
  font-size: 16px;
}

.search-input {
  padding: 0 12px;
}

.sort-select {
  padding: 0 34px 0 12px;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, #6f7480 50%),
    linear-gradient(135deg, #6f7480 50%, transparent 50%);
  background-position:
    calc(100% - 16px) calc(50% - 2px),
    calc(100% - 11px) calc(50% - 2px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}

.icon-btn {
  height: 34px;
  border: 1px solid #d4d6dc;
  border-radius: 4px;
  background: #fff;
  color: #7b7f88;
  line-height: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.icon-btn.active {
  color: #ef7b4d;
}

.create-btn {
  justify-self: end;
  height: 34px;
  min-width: 96px;
  border: none;
  border-radius: 3px;
  background: #006b65;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  padding: 0 16px;
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
