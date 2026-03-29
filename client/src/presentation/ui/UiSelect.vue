<template>
  <select
    v-bind="attrs"
    :value="modelValue ?? ''"
    class="ui-select"
    :class="[
      `ui-select--${size}`,
      {
        'ui-select--block': block,
        'ui-select--invalid': invalid,
        'ui-select--disabled': disabled,
      },
    ]"
    @change="onChange"
  >
    <slot />
  </select>
</template>

<script setup lang="ts">
import { useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null
    size?: 'sm' | 'md'
    block?: boolean
    invalid?: boolean
    disabled?: boolean
  }>(),
  {
    modelValue: '',
    size: 'md',
    block: false,
    invalid: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const attrs = useAttrs()

function onChange(event: Event): void {
  emit('update:modelValue', (event.target as HTMLSelectElement).value)
}
</script>

<style scoped>
.ui-select {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background-color: #ffffff;
  color: #2f3440;
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
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background-color 0.2s;
}

.ui-select:focus {
  outline: none;
  border-color: #066664;
  box-shadow: 0 0 0 3px rgba(6, 102, 100, 0.12);
}

.ui-select--sm {
  min-height: 34px;
  padding: 0 34px 0 12px;
  font-size: 13px;
}

.ui-select--md {
  min-height: 38px;
  padding: 0 34px 0 12px;
  font-size: 14px;
}

.ui-select--block {
  width: 100%;
}

.ui-select--invalid {
  border-color: #d9534f;
  box-shadow: 0 0 0 3px rgba(217, 83, 79, 0.12);
}

.ui-select--disabled,
.ui-select:disabled {
  background-color: #f4f5f7;
  color: #6b7280;
  cursor: not-allowed;
}
</style>
