<template>
  <div class="schemes-page">
    <div class="schemes-shell">
      <div class="controls-row">
        <input
          v-model="searchQuery"
          class="search-input"
          type="search"
          placeholder="Поиск"
        />
        <select v-model="sortBy" class="sort-select">
          <option value="name">по названию</option>
          <option value="date">по дате</option>
        </select>
        <button
          class="icon-btn"
          type="button"
          aria-label="Направление сортировки"
          @click="toggleSortDirection"
        >
          <ArrowUp v-if="sortDirection === 'asc'" :size="18" />
          <ArrowDown v-else :size="18" />
        </button>
        <button
          class="icon-btn"
          :class="{ active: showFavoritesOnly }"
          type="button"
          aria-label="Только избранные"
          @click="toggleFavoritesFilter"
        >
          <Star :size="18" :fill="showFavoritesOnly ? 'currentColor' : 'none'" />
        </button>
        <button class="create-btn" type="button" @click="$emit('create')">СОЗДАТЬ</button>
      </div>

      <div class="cards-grid">
        <article
          v-for="scheme in filteredSchemes"
          :key="scheme.id"
          class="scheme-card"
          @click="$emit('open', scheme.id)"
        >
          <button
            class="star-btn"
            :class="{ active: scheme.favorite }"
            type="button"
            aria-label="Избранное"
            @click.stop="toggleFavorite(scheme.id)"
          >
            <Star :size="16" :fill="scheme.favorite ? 'currentColor' : 'none'" />
          </button>

          <div class="preview">
            <div class="preview-placeholder">Превью схемы</div>
          </div>

          <div class="card-footer">
            <template v-if="editingSchemeId === scheme.id">
              <div class="rename-inline" @click.stop>
                <input
                  v-model="renameDraft"
                  class="rename-input"
                  type="text"
                  maxlength="120"
                  @keydown.enter.stop.prevent="saveRename(scheme.id)"
                  @keydown.esc.stop.prevent="cancelRename"
                />
                <div class="rename-actions">
                  <button
                    class="mini-btn primary"
                    type="button"
                    :disabled="!renameDraft.trim()"
                    @click.stop="saveRename(scheme.id)"
                  >
                    Сохранить
                  </button>
                  <button class="mini-btn" type="button" @click.stop="cancelRename">Отмена</button>
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
                  @click.stop="toggleMenu(scheme.id)"
                >
                  <Ellipsis :size="16" />
                </button>
                <div v-if="openedMenuId === scheme.id" class="menu-dropdown" @click.stop>
                  <button class="menu-item" type="button" @click.stop="startRename(scheme.id)">
                    <Pencil :size="14" />
                    <span>Переименовать</span>
                  </button>
                  <button class="menu-item delete" type="button" @click.stop="startDeleteConfirm(scheme.id)">
                    <Trash2 :size="14" />
                    <span>Удалить</span>
                  </button>
                </div>
                <div v-if="deletingSchemeId === scheme.id" class="delete-confirm" @click.stop>
                  <div class="delete-confirm-text">Удалить схему?</div>
                  <div class="delete-confirm-actions">
                    <button class="mini-btn danger" type="button" @click.stop="confirmDelete(scheme.id)">Удалить</button>
                    <button class="mini-btn" type="button" @click.stop="cancelDelete">Отмена</button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Ellipsis, Pencil, Star, Trash2 } from 'lucide-vue-next'

type SchemeCard = {
  id: string
  name: string
  updatedAt: string
  favorite: boolean
}

defineEmits<{
  create: []
  open: [schemeId: string]
}>()

const searchQuery = ref('')
const sortBy = ref<'name' | 'date'>('name')
const sortDirection = ref<'asc' | 'desc'>('asc')
const showFavoritesOnly = ref(false)
const openedMenuId = ref<string | null>(null)
const editingSchemeId = ref<string | null>(null)
const renameDraft = ref('')
const deletingSchemeId = ref<string | null>(null)

const schemes = ref<SchemeCard[]>([
  { id: 'scheme-1', name: 'Схема потоков данных1', updatedAt: '2026-03-10T12:00:00.000Z', favorite: true },
  { id: 'scheme-2', name: 'Схема потоков данных1', updatedAt: '2026-03-14T08:30:00.000Z', favorite: false },
  { id: 'scheme-3', name: 'Схема потоков данных', updatedAt: '2026-03-01T10:15:00.000Z', favorite: false },
  { id: 'scheme-4', name: 'Схема потоков данных', updatedAt: '2026-03-12T16:40:00.000Z', favorite: false },
  { id: 'scheme-5', name: 'Схема потоков данных', updatedAt: '2026-02-27T07:10:00.000Z', favorite: false },
  { id: 'scheme-6', name: 'Схема потоков данных', updatedAt: '2026-03-15T06:05:00.000Z', favorite: false }
])

const filteredSchemes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  let list = schemes.value.filter(item => item.name.toLowerCase().includes(query))

  if (showFavoritesOnly.value) {
    list = list.filter(item => item.favorite)
  }

  if (sortBy.value === 'name') {
    list = [...list].sort((a, b) => {
      const byName = a.name.localeCompare(b.name, 'ru')
      if (byName !== 0) return sortDirection.value === 'asc' ? byName : -byName
      return a.id.localeCompare(b.id, 'ru')
    })
  } else {
    list = [...list].sort((a, b) => {
      const byTime = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      if (byTime !== 0) return sortDirection.value === 'asc' ? byTime : -byTime
      const byName = a.name.localeCompare(b.name, 'ru')
      if (byName !== 0) return byName
      return a.id.localeCompare(b.id, 'ru')
    })
  }

  return list
})

function toggleSortDirection(): void {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
}

function toggleFavoritesFilter(): void {
  showFavoritesOnly.value = !showFavoritesOnly.value
}

function formatUpdatedAt(isoDate: string): string {
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

function toggleFavorite(id: string): void {
  const item = schemes.value.find(s => s.id === id)
  if (!item) return
  item.favorite = !item.favorite
}

function toggleMenu(id: string): void {
  if (editingSchemeId.value === id) return
  deletingSchemeId.value = null
  openedMenuId.value = openedMenuId.value === id ? null : id
}

function startRename(id: string): void {
  const scheme = schemes.value.find(item => item.id === id)
  if (!scheme) return
  deletingSchemeId.value = null
  openedMenuId.value = null
  editingSchemeId.value = id
  renameDraft.value = scheme.name
}

function saveRename(id: string): void {
  const scheme = schemes.value.find(item => item.id === id)
  if (!scheme) return
  const nextName = renameDraft.value.trim()
  if (!nextName) return
  scheme.name = nextName
  editingSchemeId.value = null
  renameDraft.value = ''
}

function cancelRename(): void {
  editingSchemeId.value = null
  renameDraft.value = ''
}

function startDeleteConfirm(id: string): void {
  openedMenuId.value = null
  deletingSchemeId.value = id
}

function cancelDelete(): void {
  deletingSchemeId.value = null
}

function confirmDelete(id: string): void {
  schemes.value = schemes.value.filter(item => item.id !== id)
  if (editingSchemeId.value === id) {
    editingSchemeId.value = null
    renameDraft.value = ''
  }
  deletingSchemeId.value = null
  openedMenuId.value = null
}
</script>

<style scoped>
.schemes-page {
  height: 100%;
  overflow: auto;
  background: #dfe1e6;
}

.schemes-shell {
  max-width: 1260px;
  margin: 0 auto;
  padding: 40px 8px 24px;
}

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

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, 400px);
  justify-content: center;
  gap: 20px;
}

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
  background: #f5f6f8;
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

.rename-input {
  width: 100%;
  height: 30px;
  border: 1px solid #cfd4dc;
  border-radius: 4px;
  padding: 0 8px;
  font-size: 13px;
  color: #2f3440;
}

.rename-actions {
  display: flex;
  gap: 6px;
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

.mini-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.mini-btn.primary {
  border-color: #066664;
  color: #066664;
}

.mini-btn.danger {
  border-color: #b43b33;
  color: #b43b33;
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

@media (max-width: 1024px) {
  .cards-grid {
    grid-template-columns: 400px;
  }
}

@media (max-width: 700px) {
  .schemes-shell {
    padding: 16px 8px;
  }

  .controls-row {
    grid-template-columns: 1fr 1fr 38px 38px;
  }

  .create-btn {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .cards-grid {
    grid-template-columns: minmax(280px, 1fr);
  }

  .scheme-card {
    width: 100%;
    max-width: 400px;
  }
}
</style>
