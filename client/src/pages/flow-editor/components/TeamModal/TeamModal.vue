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
        <div class="team-section">
          <div class="section-title">Участники</div>
          <ul class="team-list">
            <li class="team-row" v-for="member in members" :key="member.email">
              <div class="member-info">
                <div class="avatar-circle small">{{ member.initials }}</div>
                <div class="member-text">
                  <div class="member-name">{{ member.name }}</div>
                  <div class="member-email">{{ member.email }}</div>
                </div>
              </div>
              <span class="member-role">{{ member.role }}</span>
            </li>
          </ul>
        </div>

        <div class="team-section">
          <div class="section-title">Ссылка на схему</div>
          <div class="link-box">
            <span>{{ shareLink }}</span>
            <UiButton size="sm" variant="outline">Копировать</UiButton>
          </div>
        </div>

        <div class="team-section">
          <div class="section-title">Добавить участника</div>
          <div class="invite-row">
            <UiInput type="text" size="md" block placeholder="email или имя пользователя" disabled />
            <UiSelect size="md" block disabled>
              <option>Редактор</option>
              <option>Чтение</option>
            </UiSelect>
            <UiButton variant="neutral" disabled>Пригласить</UiButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { X } from 'lucide-vue-next'
import UiButton from '@/components/ui/UiButton.vue'
import UiInput from '@/components/ui/UiInput.vue'
import UiSelect from '@/components/ui/UiSelect.vue'
import { useEditorUiStore } from '@/stores'

const uiStore = useEditorUiStore()

const {
  showTeamModal,
  shareLink,
  teamMembers: members,
} = storeToRefs(uiStore)

const closeTeamModal = () => uiStore.setShowTeamModal(false)
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.32);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 13000;
}

.modal-window {
  width: min(640px, 100%);
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 700;
}

.close-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.modal-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.team-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  font-size: 13px;
  font-weight: 700;
  color: #374151;
}

.team-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.team-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.member-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-weight: 600;
}

.member-email,
.member-role {
  font-size: 13px;
  color: #6b7280;
}

.avatar-circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #dbe4ff;
  color: #1d4ed8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.avatar-circle.small {
  width: 28px;
  height: 28px;
}

.link-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.invite-row {
  display: grid;
  grid-template-columns: 1fr 140px auto;
  gap: 10px;
}
</style>
