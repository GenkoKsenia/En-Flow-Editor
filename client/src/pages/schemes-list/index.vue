<template>
  <div class="schemes-page">
    <div class="schemes-shell">
      <SchemesListFilter
        :search-query="searchQuery"
        :sort-by="sortBy"
        :sort-direction="sortDirection"
        :show-favorites-only="showFavoritesOnly"
        @update:searchQuery="searchQuery = $event"
        @update:sortBy="sortBy = $event"
        @toggle-sort-direction="toggleSortDirection"
        @toggle-favorites-filter="toggleFavoritesFilter"
        @create="openCreateModal"
      />
      <div v-if="deleteError" class="inline-error">{{ deleteError }}</div>

      <SchemesList
        :schemes="filteredSchemes"
        :is-loading="isLoading"
        :error-message="loadError"
        :editing-scheme-id="editingSchemeId"
        :rename-draft="renameDraft"
        :opened-menu-id="openedMenuId"
        :deleting-scheme-id="deletingSchemeId"
        :is-deleting="isDeleting"
        @retry="refetch"
        @open="openScheme"
        @toggle-favorite="toggleFavorite"
        @toggle-menu="toggleMenu"
        @start-rename="startRename"
        @update:renameDraft="renameDraft = $event"
        @save-rename="saveRename"
        @cancel-rename="cancelRename"
        @start-delete-confirm="startDeleteConfirm"
        @confirm-delete="confirmDelete"
        @cancel-delete="cancelDelete"
      />
    </div>

    <CreateSchemeModal
      :open="isCreateModalOpen"
      @close="closeCreateModal"
      @created="handleSchemeCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { deleteScheme } from '@/api/schemes'
import CreateSchemeModal from '@/components/CreateSchemeModal.vue'
import { useSchemesList } from '@/composables/useSchemesList'

import SchemesList from './components/SchemesList.vue'
import SchemesListFilter from './components/SchemesListFilter.vue'

const router = useRouter()
const searchQuery = ref('')
const sortBy = ref<'name' | 'date'>('name')
const sortDirection = ref<'asc' | 'desc'>('asc')
const showFavoritesOnly = ref(false)
const openedMenuId = ref<string | null>(null)
const editingSchemeId = ref<string | null>(null)
const renameDraft = ref('')
const deletingSchemeId = ref<string | null>(null)
const isCreateModalOpen = ref(false)
const isDeleting = ref(false)
const deleteError = ref('')
const { data: schemes, error, isLoading, refetch } = useSchemesList()

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
      const byTime = getUpdatedAtTimestamp(a.updatedAt) - getUpdatedAtTimestamp(b.updatedAt)
      if (byTime !== 0) return sortDirection.value === 'asc' ? byTime : -byTime
      const byName = a.name.localeCompare(b.name, 'ru')
      if (byName !== 0) return byName
      return a.id.localeCompare(b.id, 'ru')
    })
  }

  return list
})

const loadError = computed(() => error.value?.message ?? '')

function toggleSortDirection(): void {
  sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
}

function toggleFavoritesFilter(): void {
  showFavoritesOnly.value = !showFavoritesOnly.value
}

function getUpdatedAtTimestamp(isoDate: string | null): number {
  if (!isoDate) return Number.NEGATIVE_INFINITY

  const timestamp = new Date(isoDate).getTime()
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}

function toggleFavorite(id: string): void {
  const item = schemes.value.find(s => s.id === id)
  if (!item) return
  item.favorite = !item.favorite
}

function openScheme(schemeId: string): void {
  void router.push({
    name: 'scheme-editor',
    params: { schemeId },
  })
}

function openCreateModal(): void {
  isCreateModalOpen.value = true
}

function closeCreateModal(): void {
  isCreateModalOpen.value = false
}

async function handleSchemeCreated(): Promise<void> {
  await refetch()
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
  deleteError.value = ''
  openedMenuId.value = null
  deletingSchemeId.value = id
}

function cancelDelete(): void {
  if (isDeleting.value) return
  deletingSchemeId.value = null
}

async function confirmDelete(id: string): Promise<void> {
  if (isDeleting.value) return

  isDeleting.value = true
  deleteError.value = ''

  try {
    await deleteScheme(id)
    schemes.value = schemes.value.filter(item => item.id !== id)

    if (editingSchemeId.value === id) {
      editingSchemeId.value = null
      renameDraft.value = ''
    }

    deletingSchemeId.value = null
    openedMenuId.value = null
  } catch (deleteCause) {
    console.error('Не удалось удалить схему', deleteCause)
    deleteError.value = 'Не удалось удалить схему'
  } finally {
    isDeleting.value = false
  }
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

.inline-error {
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid #e0b4b0;
  border-radius: 4px;
  background: #fff;
  color: #8f2f28;
  font-size: 13px;
}

@media (max-width: 700px) {
  .schemes-shell {
    padding: 16px 8px;
  }
}
</style>
