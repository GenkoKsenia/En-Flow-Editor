<template>
  <div class="flow-editor">
    <div class="scheme-bar">
      <div class="scheme-bar__main">
        <router-link class="scheme-bar__back" :to="{ name: 'schemes' }">
          Все схемы
        </router-link>
        <div class="scheme-bar__divider" aria-hidden="true" />

        <form
          v-if="isEditingSchemeName"
          class="scheme-bar__edit"
          @submit.prevent="saveSchemeName"
        >
          <UiInput
            v-model="schemeNameDraft"
            class="scheme-bar__input"
            block
            maxlength="120"
            placeholder="Введите название схемы"
            :disabled="isSchemeLoading || isSavingSchemeName"
            @keydown.esc.prevent="cancelSchemeNameEditing"
          />
          <UiButton
            type="submit"
            variant="primary"
            size="sm"
            :disabled="isSaveDisabled"
          >
            {{ isSavingSchemeName ? 'Сохранение...' : 'Сохранить' }}
          </UiButton>
        </form>

        <button
          v-else
          type="button"
          class="scheme-bar__title-button"
          :disabled="!scheme || isSchemeLoading"
          @click="startSchemeNameEditing"
        >
          {{ scheme?.name || `Схема ${schemeId ?? ''}` }}
        </button>
      </div>

      <div v-if="schemeErrorMessage" class="scheme-bar__message scheme-bar__message--error">
        {{ schemeErrorMessage }}
      </div>
      <div v-else-if="saveErrorMessage" class="scheme-bar__message scheme-bar__message--error">
        {{ saveErrorMessage }}
      </div>
      <div v-else-if="saveSuccessMessage" class="scheme-bar__message scheme-bar__message--success">
        {{ saveSuccessMessage }}
      </div>
    </div>

    <div class="editor-layout">
      <FlowEditorCodePane />
      <FlowEditorWorkspace />
    </div>

    <TeamModal />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { updateSchemeName, useScheme } from '@/domains/schemes'
import UiButton from '@/presentation/ui/UiButton.vue'
import UiInput from '@/presentation/ui/UiInput.vue'

import FlowEditorCodePane from './components/FlowEditorCodePane/FlowEditorCodePane.vue'
import FlowEditorWorkspace from './components/FlowEditorWorkspace/FlowEditorWorkspace.vue'
import TeamModal from './components/TeamModal/TeamModal.vue'
import { useFlowEditorRoute } from './composables/useFlowEditorRoute'

const { schemeId } = useFlowEditorRoute()
const { data: scheme, error: schemeError, isLoading: isSchemeLoading } = useScheme(schemeId)

const schemeNameDraft = ref('')
const isEditingSchemeName = ref(false)
const isSavingSchemeName = ref(false)
const saveErrorMessage = ref('')
const saveSuccessMessage = ref('')

const normalizedSchemeNameDraft = computed(() => schemeNameDraft.value.trim())
const currentSchemeName = computed(() => scheme.value?.name ?? '')
const isSaveDisabled = computed(() => (
  !scheme.value
  || isSchemeLoading.value
  || isSavingSchemeName.value
  || !normalizedSchemeNameDraft.value
  || normalizedSchemeNameDraft.value === currentSchemeName.value
))
const schemeErrorMessage = computed(() => schemeError.value?.message ?? '')

watch(
  scheme,
  nextScheme => {
    schemeNameDraft.value = nextScheme?.name ?? ''
    isEditingSchemeName.value = false
    saveErrorMessage.value = ''
    saveSuccessMessage.value = ''
  },
  { immediate: true },
)

watch(schemeId, () => {
  isEditingSchemeName.value = false
  saveErrorMessage.value = ''
  saveSuccessMessage.value = ''
})

function startSchemeNameEditing(): void {
  if (!scheme.value || isSchemeLoading.value) return
  schemeNameDraft.value = currentSchemeName.value
  isEditingSchemeName.value = true
  saveErrorMessage.value = ''
  saveSuccessMessage.value = ''
}

function cancelSchemeNameEditing(): void {
  schemeNameDraft.value = currentSchemeName.value
  isEditingSchemeName.value = false
  saveErrorMessage.value = ''
  saveSuccessMessage.value = ''
}

async function saveSchemeName(): Promise<void> {
  if (!schemeId.value || isSaveDisabled.value) return

  isSavingSchemeName.value = true
  saveErrorMessage.value = ''
  saveSuccessMessage.value = ''

  try {
    const updatedScheme = await updateSchemeName(schemeId.value, normalizedSchemeNameDraft.value)
    scheme.value = updatedScheme
    schemeNameDraft.value = updatedScheme.name
    isEditingSchemeName.value = false
    saveSuccessMessage.value = 'Название схемы обновлено'
  } catch (cause) {
    console.error('Не удалось обновить название схемы', cause)
    saveErrorMessage.value = 'Не удалось сохранить новое название схемы'
  } finally {
    isSavingSchemeName.value = false
  }
}
</script>

<style scoped>
.flow-editor {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
}

.scheme-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 16px;
  min-height: 58px;
  padding: 10px 18px;
  border-bottom: 1px solid #dee2e6;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(8px);
}

.scheme-bar__main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1 1 100%;
  min-width: 0;
}

.scheme-bar__back {
  display: inline-flex;
  font-size: 13px;
  font-weight: 600;
  color: #066664;
  text-decoration: none;
  white-space: nowrap;
}

.scheme-bar__back:hover {
  text-decoration: underline;
}

.scheme-bar__divider {
  width: 1px;
  height: 18px;
  background: #d6d9df;
}

.scheme-bar__title-button {
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.scheme-bar__input {
  min-width: 220px;
}

.scheme-bar__title-button:hover:not(:disabled) {
  color: #066664;
}

.scheme-bar__title-button:disabled {
  cursor: default;
}

.scheme-bar__edit {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 380px;
}

.scheme-bar__message {
  flex: 1 1 100%;
  font-size: 13px;
  margin-top: -2px;
}

.scheme-bar__message--error {
  color: #b42318;
}

.scheme-bar__message--success {
  color: #166534;
}

.editor-layout {
  flex: 1;
  display: flex;
  height: 100%;
  width: 100%;
}

@media (max-width: 768px) {
  .scheme-bar {
    padding: 10px 12px;
  }

  .scheme-bar__main {
    gap: 8px;
  }

  .editor-layout {
    flex-direction: column;
  }

  .scheme-bar__edit {
    width: 100%;
    flex-wrap: wrap;
  }

  .scheme-bar__input {
    max-width: none;
    min-width: 0;
  }

  .scheme-bar__title-button {
    font-size: 16px;
  }
}
</style>
