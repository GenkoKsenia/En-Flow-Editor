<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-window" :style="modalStyle" role="dialog" aria-modal="true" :aria-label="title">
        <div class="modal-header">
          <span>{{ title }}</span>
          <button class="close-btn" type="button" aria-label="Закрыть" @click="$emit('close')">
            <X :size="16" />
          </button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  width?: string
}>(), {
  width: '420px',
})

const emit = defineEmits<{
  close: []
}>()

const modalStyle = computed(() => ({
  width: props.width,
}))

function onWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !props.open) return
  emit('close')
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', onWindowKeydown)
      return
    }

    window.removeEventListener('keydown', onWindowKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
}

.modal-window {
  max-width: 100%;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 700;
  margin-bottom: 12px;
}

.modal-body {
  color: #333;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
  padding: 4px;
}
</style>
