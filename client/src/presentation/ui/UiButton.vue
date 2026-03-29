<template>
  <button
    :type="type"
    class="ui-button"
    :class="[
      `ui-button--${variant}`,
      `ui-button--${size}`,
      `ui-button--align-${align}`,
      {
        'ui-button--block': block,
        'ui-button--pill': pill,
        'ui-button--active': active,
      },
    ]"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'outline' | 'neutral' | 'surface' | 'danger-outline'
    size?: 'sm' | 'md' | 'icon'
    align?: 'center' | 'start'
    block?: boolean
    pill?: boolean
    active?: boolean
  }>(),
  {
    type: 'button',
    variant: 'neutral',
    size: 'md',
    align: 'center',
    block: false,
    pill: false,
    active: false,
  },
)
</script>

<style scoped>
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 600;
  transition:
    background-color 0.2s,
    border-color 0.2s,
    color 0.2s,
    box-shadow 0.2s,
    transform 0.1s;
}

.ui-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.ui-button--md {
  min-height: 40px;
  padding: 8px 16px;
  font-size: 14px;
}

.ui-button--sm {
  min-height: 34px;
  padding: 6px 12px;
  font-size: 13px;
}

.ui-button--icon {
  width: 40px;
  min-width: 40px;
  height: 40px;
  padding: 0;
  font-size: 18px;
}

.ui-button--align-start {
  justify-content: flex-start;
}

.ui-button--block {
  width: 100%;
}

.ui-button--pill {
  border-radius: 999px;
}

.ui-button--primary {
  background: #066664;
  border-color: #066664;
  color: #ffffff;
}

.ui-button--primary:hover:not(:disabled) {
  background: #044746;
  border-color: #044746;
}

.ui-button--outline {
  background: #ffffff;
  border-color: #066664;
  color: #066664;
}

.ui-button--outline:hover:not(:disabled) {
  background: #e6f4f1;
}

.ui-button--outline.ui-button--active {
  background: #94bea9;
  border-color: #94bea9;
  color: #ffffff;
  box-shadow: 0 0 0 2px rgba(6, 102, 100, 0.25);
}

.ui-button--neutral {
  background: #ffffff;
  border-color: #e1e5ea;
  color: #111111;
}

.ui-button--neutral:hover:not(:disabled) {
  background: #f5f5f5;
}

.ui-button--neutral.ui-button--pill:hover:not(:disabled) {
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}

.ui-button--surface {
  background: #f0f1f4;
  border-color: #a6abb4;
  color: #2f3440;
}

.ui-button--surface:hover:not(:disabled) {
  background: #e6e8ed;
}

.ui-button--danger-outline {
  background: #ffffff;
  border-color: #dc3545;
  color: #dc3545;
}

.ui-button--danger-outline:hover:not(:disabled) {
  background: #c82333;
  border-color: #c82333;
  color: #ffffff;
}
</style>
