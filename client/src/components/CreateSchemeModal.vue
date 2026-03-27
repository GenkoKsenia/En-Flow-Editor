<template>
  <BaseModal :open="open" title="Создать схему" width="440px" @close="onClose">
    <form class="create-form" @submit.prevent="submit">
      <label class="field-label" for="scheme-name">Название схемы</label>
      <input
        id="scheme-name"
        v-model="schemeName"
        class="name-input"
        type="text"
        maxlength="120"
        placeholder="Введите название"
        :disabled="isSubmitting"
        @keydown.enter.prevent="submit"
      />
      <div v-if="submitError" class="submit-error">{{ submitError }}</div>
    </form>

    <template #footer>
      <button class="action-btn secondary" type="button" :disabled="isSubmitting" @click="onClose">
        Отмена
      </button>
      <button
        class="action-btn primary"
        type="button"
        :disabled="isSubmitting || !schemeName.trim()"
        @click="submit"
      >
        {{ isSubmitting ? 'Создание...' : 'Создать' }}
      </button>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { createScheme } from '@/api/schemes'

import BaseModal from './BaseModal.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

const schemeName = ref('')
const isSubmitting = ref(false)
const submitError = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    schemeName.value = ''
    submitError.value = ''
    isSubmitting.value = false
  },
)

function onClose(): void {
  if (isSubmitting.value) return
  emit('close')
}

async function submit(): Promise<void> {
  const nextName = schemeName.value.trim()
  if (!nextName || isSubmitting.value) return

  isSubmitting.value = true
  submitError.value = ''

  try {
    await createScheme(nextName)
    emit('created')
    emit('close')
  } catch (cause) {
    console.error('Не удалось создать схему', cause)
    submitError.value = 'Не удалось создать схему'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.create-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #39414d;
}

.name-input {
  width: 100%;
  height: 38px;
  border: 1px solid #cfd4dc;
  border-radius: 6px;
  padding: 0 12px;
  font-size: 14px;
  color: #2f3440;
}

.name-input:disabled {
  background: #f4f5f7;
}

.submit-error {
  padding: 10px 12px;
  border: 1px solid #e0b4b0;
  border-radius: 6px;
  background: #fff6f5;
  color: #8f2f28;
  font-size: 13px;
}

.action-btn {
  min-width: 110px;
  height: 34px;
  border-radius: 6px;
  padding: 0 14px;
  font-size: 13px;
  cursor: pointer;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.secondary {
  border: 1px solid #d1d6de;
  background: #fff;
  color: #4e5460;
}

.action-btn.primary {
  border: none;
  background: #006b65;
  color: #fff;
}
</style>
