<template>
  <input
    v-bind="attrs"
    :type="type"
    :value="modelValue ?? ''"
    class="ui-input"
    :class="[
      `ui-input--${size}`,
      {
        'ui-input--block': block,
        'ui-input--invalid': invalid,
        'ui-input--disabled': disabled,
        'ui-input--color': type === 'color',
      },
    ]"
    @input="onInput"
  />
</template>

<script setup lang="ts">
import { useAttrs } from 'vue'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    modelValue?: string | number | null
    type?: 'text' | 'search' | 'number' | 'email' | 'password' | 'url' | 'color'
    size?: 'sm' | 'md'
    block?: boolean
    invalid?: boolean
    disabled?: boolean
  }>(),
  {
    modelValue: '',
    type: 'text',
    size: 'md',
    block: false,
    invalid: false,
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const attrs = useAttrs()

function onInput(event: Event): void {
  const target = event.target as HTMLInputElement
  if (props.type === 'number') {
    emit('update:modelValue', target.value === '' ? '' : Number(target.value))
    return
  }

  emit('update:modelValue', target.value)
}
</script>

<style scoped>
.ui-input {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  color: #2f3440;
  transition:
    border-color 0.2s,
    box-shadow 0.2s,
    background-color 0.2s;
}

.ui-input::placeholder {
  color: #8b93a1;
}

.ui-input:focus {
  outline: none;
  border-color: #066664;
  box-shadow: 0 0 0 3px rgba(6, 102, 100, 0.12);
}

.ui-input--sm {
  min-height: 34px;
  padding: 0 12px;
  font-size: 13px;
}

.ui-input--md {
  min-height: 38px;
  padding: 0 12px;
  font-size: 14px;
}

.ui-input--block {
  width: 100%;
}

.ui-input--invalid {
  border-color: #d9534f;
  box-shadow: 0 0 0 3px rgba(217, 83, 79, 0.12);
}

.ui-input--disabled,
.ui-input:disabled {
  background: #f4f5f7;
  color: #6b7280;
  cursor: not-allowed;
}

.ui-input--color {
  padding: 2px;
  min-width: 44px;
}
</style>
