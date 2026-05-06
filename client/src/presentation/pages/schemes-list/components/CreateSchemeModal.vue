<template>
  <BaseModal :open="open" title="Создать схему" width="440px" @close="onClose">
    <form class="create-form" @submit.prevent="submit">
      <label class="field-label" for="scheme-name">Название схемы</label>
      <UiInput
        id="scheme-name"
        v-model="schemeName"
        type="text"
        block
        maxlength="120"
        placeholder="Введите название"
        :disabled="isSubmitting"
        @keydown.enter.prevent="submit"
      />
      <div v-if="submitError" class="submit-error">{{ submitError }}</div>
    </form>

    <template #footer>
      <UiButton variant="neutral" size="sm" :disabled="isSubmitting" @click="onClose">
        Отмена
      </UiButton>
      <UiButton
        variant="primary"
        size="sm"
        :disabled="isSubmitting || !schemeName.trim()"
        @click="submit"
      >
        {{ isSubmitting ? 'Создание...' : 'Создать' }}
      </UiButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { createScheme } from '@/domains/schemes'

import BaseModal from '@/presentation/ui/BaseModal.vue'
import UiButton from '@/presentation/ui/UiButton.vue'
import UiInput from '@/presentation/ui/UiInput.vue'

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

.submit-error {
  padding: 10px 12px;
  border: 1px solid #e0b4b0;
  border-radius: 6px;
  background: #fff6f5;
  color: #8f2f28;
  font-size: 13px;
}

:deep(.ui-button) {
  min-width: 110px;
}
</style>
