<template>
  <div v-if="showTeamModal" class="modal-backdrop" @click.self="closeTeamModal">
    <div class="modal-window">
      <div class="modal-header">
        <span>Команда</span>
        <button class="close-btn" @click="closeTeamModal" aria-label="Закрыть">
          <X :size="16" />
        </button>
      </div>

      <div class="modal-body">
        <section class="team-section">
          <div class="section-title">Ссылка на схему</div>
          <div class="share-card">
            <a class="share-link" :href="resolvedShareLink" target="_blank" rel="noreferrer">
              {{ resolvedShareLink }}
            </a>
            <UiButton size="sm" variant="outline" @click="copyShareLink">
              {{ copyButtonLabel }}
            </UiButton>
          </div>
        </section>

        <section v-if="canToggleReadOnly" class="team-section">
          <div class="section-title">Режим схемы</div>
          <div class="scheme-mode-card">
            <div class="scheme-mode-copy">
              <div class="scheme-mode-title">
                {{ isReadOnly ? 'Только просмотр' : 'Редактирование доступно' }}
              </div>
            </div>
            <UiButton
              size="sm"
              :variant="isReadOnly ? 'surface' : 'neutral'"
              :disabled="isTogglingReadOnly"
              @click="$emit('toggle-read-only')"
            >
              {{ isTogglingReadOnly ? 'Сохранение...' : (isReadOnly ? 'Открыть редактирование' : 'Закрыть редактирование') }}
            </UiButton>
          </div>
        </section>

        <section class="team-section team-section--members">
          <div class="section-title">Участники</div>

          <div class="team-list-wrap">
            <ul class="team-list">
              <li class="team-row" v-for="member in localMembers" :key="member.email">
                <div class="member-info">
                  <div class="avatar-circle" :class="avatarClass(member.role)">{{ member.initials }}</div>
                  <div class="member-text">
                    <div class="member-name">{{ member.name }}</div>
                    <div class="member-email">{{ member.email }}</div>
                  </div>
                </div>

                <div class="member-actions">
                  <UiSelect
                    :model-value="member.role"
                    size="sm"
                    @update:model-value="setMemberRole(member.email, $event)"
                  >
                    <option :value="EDITOR_ROLE">Редактирование</option>
                    <option :value="VIEWER_ROLE">Просмотр</option>
                  </UiSelect>
                  <UiButton size="sm" variant="danger-outline" @click="removeMember(member.email)">
                    Удалить
                  </UiButton>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section class="team-section">
          <div class="section-title">Пригласить участника</div>

          <div class="invite-panel">
            <div class="user-picker">
              <div class="user-picker__row">
                <UiInput
                  v-model="inviteQuery"
                  type="text"
                  size="md"
                  block
                  placeholder="Имя участника"
                  @focus="openUserMenu"
                />
                <button
                  type="button"
                  class="user-picker__toggle"
                  aria-label="Показать доступных пользователей"
                  @click="toggleUserMenu"
                >
                  ▾
                </button>
              </div>

              <div v-if="isUserMenuOpen" class="user-picker__menu">
                <button
                  v-for="user in filteredUserOptions"
                  :key="user.email"
                  type="button"
                  class="user-picker__option"
                  @click="selectInviteUser(user)"
                >
                  <span class="user-picker__option-name">{{ user.name }}</span>
                  <span class="user-picker__option-email">{{ user.email }}</span>
                </button>
                <div v-if="filteredUserOptions.length === 0" class="user-picker__empty">
                  Пользователи не найдены
                </div>
              </div>
            </div>

            <UiSelect v-model="inviteRole" size="md" block>
              <option :value="EDITOR_ROLE">Редактирование</option>
              <option :value="VIEWER_ROLE">Просмотр</option>
            </UiSelect>

            <UiButton variant="primary" :disabled="!canInvite" @click="inviteMember">
              Пригласить
            </UiButton>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { X } from 'lucide-vue-next'

import UiButton from '@/presentation/ui/UiButton.vue'
import UiInput from '@/presentation/ui/UiInput.vue'
import UiSelect from '@/presentation/ui/UiSelect.vue'
import { useEditorUiStore } from '@/presentation/pages/flow-editor/store'
import type { TeamMember } from '@/domains/diagram'
import { getUserInitials } from '@/shared/lib/getUserInitials'

defineProps<{
  isReadOnly: boolean
  canToggleReadOnly: boolean
  isTogglingReadOnly: boolean
}>()

defineEmits<{
  'toggle-read-only': []
}>()

const EDITOR_ROLE = 'Редактирование'
const VIEWER_ROLE = 'Просмотр'

type UserDirectoryEntry = {
  name: string
  email: string
}

const USER_DIRECTORY: UserDirectoryEntry[] = [
  { name: 'Иванов И.И.', email: 'ivanov@mail.ru' },
  { name: 'Петров П.П.', email: 'petrov@mail.ru' },
  { name: 'Сидоров С.С.', email: 'sidorov@mail.ru' },
  { name: 'Кузнецова А.А.', email: 'kuznetsova@mail.ru' },
  { name: 'Смирнов Д.В.', email: 'smirnov@mail.ru' },
  { name: 'Морозова Е.Н.', email: 'morozova@mail.ru' },
]

const uiStore = useEditorUiStore()

const {
  showTeamModal,
  shareLink,
  teamMembers,
} = storeToRefs(uiStore)

const localMembers = ref<TeamMember[]>([])
const inviteQuery = ref('')
const inviteRole = ref(EDITOR_ROLE)
const selectedInviteUser = ref<UserDirectoryEntry | null>(null)
const isUserMenuOpen = ref(false)
const copyButtonLabel = ref('Копировать')

const resolvedShareLink = computed(() => {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href
  }

  return shareLink.value
})

const filteredUserOptions = computed(() => {
  const query = inviteQuery.value.trim().toLowerCase()
  const existingEmails = new Set(localMembers.value.map(member => member.email.toLowerCase()))

  return USER_DIRECTORY.filter(user => {
    if (existingEmails.has(user.email.toLowerCase()) && selectedInviteUser.value?.email !== user.email) {
      return false
    }

    if (!query) return true

    return user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
  })
})

const canInvite = computed(() => selectedInviteUser.value !== null)

watch(
  showTeamModal,
  isOpen => {
    if (!isOpen) return

    localMembers.value = teamMembers.value.map(member => ({
      ...member,
      initials: getUserInitials(member.name),
      role: normalizeRole(member.role),
    }))
    resetInviteForm()
    copyButtonLabel.value = 'Копировать'
  },
  { immediate: true },
)

watch(inviteQuery, value => {
  if (selectedInviteUser.value && value.trim() !== selectedInviteUser.value.name) {
    selectedInviteUser.value = null
  }
})

function closeTeamModal(): void {
  uiStore.setShowTeamModal(false)
}

function normalizeRole(role: string): string {
  if (role === VIEWER_ROLE || role === 'Чтение') {
    return VIEWER_ROLE
  }

  return EDITOR_ROLE
}

function resetInviteForm(): void {
  inviteQuery.value = ''
  inviteRole.value = EDITOR_ROLE
  selectedInviteUser.value = null
  isUserMenuOpen.value = false
}

function openUserMenu(): void {
  isUserMenuOpen.value = true
}

function toggleUserMenu(): void {
  isUserMenuOpen.value = !isUserMenuOpen.value
}

function selectInviteUser(user: UserDirectoryEntry): void {
  selectedInviteUser.value = user
  inviteQuery.value = user.name
  isUserMenuOpen.value = false
}

async function copyShareLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(resolvedShareLink.value)
    copyButtonLabel.value = 'Скопировано'
    window.setTimeout(() => {
      copyButtonLabel.value = 'Копировать'
    }, 1600)
  } catch {
    copyButtonLabel.value = 'Ошибка'
    window.setTimeout(() => {
      copyButtonLabel.value = 'Копировать'
    }, 1600)
  }
}

function inviteMember(): void {
  if (!selectedInviteUser.value) return

  const existing = localMembers.value.find(member => member.email.toLowerCase() === selectedInviteUser.value!.email.toLowerCase())
  if (existing) {
    existing.role = inviteRole.value
    resetInviteForm()
    return
  }

  localMembers.value = [
    {
      initials: getUserInitials(selectedInviteUser.value.name),
      name: selectedInviteUser.value.name,
      email: selectedInviteUser.value.email,
      role: inviteRole.value,
    },
    ...localMembers.value,
  ]

  resetInviteForm()
}

function setMemberRole(email: string, role: string): void {
  localMembers.value = localMembers.value.map(member =>
    member.email === email
      ? { ...member, role }
      : member,
  )
}

function removeMember(email: string): void {
  localMembers.value = localMembers.value.filter(member => member.email !== email)
}

function avatarClass(role: string): string {
  return role === EDITOR_ROLE
    ? 'avatar-circle--editor'
    : 'avatar-circle--viewer'
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(circle at top, rgba(8, 145, 178, 0.12), transparent 28%),
    rgba(15, 23, 42, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 13000;
}

.modal-window {
  width: min(920px, 100%);
  max-height: min(88vh, 920px);
  background: #fff;
  border: 1px solid rgba(203, 213, 225, 0.9);
  border-radius: 18px;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.24);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 22px 18px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, rgba(240, 249, 255, 0.95), rgba(248, 250, 252, 0.98));
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
}

.close-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #dbe3ec;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #475569;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  border-color: #0b6bcb;
  color: #0b6bcb;
}

.modal-body {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  overflow: hidden;
}

.team-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.team-section--members {
  flex: 1 1 auto;
  min-height: 0;
}

.section-title {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
}

.share-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid #d9e4ec;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(236, 253, 245, 0.9), rgba(239, 246, 255, 0.95));
}

.share-link {
  color: #0b6bcb;
  font-size: 15px;
  font-weight: 700;
  word-break: break-all;
  text-decoration: none;
}

.share-link:hover {
  text-decoration: underline;
}

.scheme-mode-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  border: 1px solid #d9e4ec;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(236, 253, 245, 0.9), rgba(255, 255, 255, 0.96));
}

.scheme-mode-copy {
  min-width: 0;
}

.scheme-mode-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.team-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.team-list-wrap {
  min-height: 0;
  max-height: 100%;
  overflow-y: auto;
  padding-right: 4px;
}

.team-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #fff;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.avatar-circle {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  flex: 0 0 auto;
}

.avatar-circle--editor {
  background: #dff7eb;
  color: #0f766e;
}

.avatar-circle--viewer {
  background: #e8eefb;
  color: #1d4ed8;
}

.member-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.member-name {
  font-weight: 700;
  color: #0f172a;
}

.member-email {
  font-size: 13px;
  color: #64748b;
  word-break: break-all;
}

.member-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.invite-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 200px auto;
  gap: 10px;
  align-items: center;
}

.user-picker {
  position: relative;
}

.user-picker__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  gap: 10px;
  align-items: stretch;
}

.user-picker__toggle {
  width: 44px;
  height: 40px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: #fff;
  color: #475569;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.invite-panel :deep(.ui-input--md),
.invite-panel :deep(.ui-select--md),
.invite-panel :deep(.ui-button--md) {
  min-height: 40px;
}

.user-picker__toggle:hover {
  border-color: #0b6bcb;
  color: #0b6bcb;
}

.user-picker__menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #d9e1ea;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.16);
  z-index: 20;
  padding: 6px;
}

.user-picker__option {
  width: 100%;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.user-picker__option:hover {
  background: #f8fafc;
}

.user-picker__option-name {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.user-picker__option-email {
  font-size: 12px;
  color: #64748b;
}

.user-picker__empty {
  padding: 12px;
  font-size: 13px;
  color: #64748b;
}

@media (max-width: 900px) {
  .team-row,
  .share-card {
    flex-direction: column;
    align-items: stretch;
  }

  .member-actions {
    justify-content: flex-start;
  }

  .invite-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .modal-backdrop {
    padding: 12px;
  }

  .modal-window {
    max-height: 92vh;
    border-radius: 14px;
  }

  .modal-header,
  .modal-body {
    padding: 16px;
  }
}
</style>
