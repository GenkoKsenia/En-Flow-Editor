<template>
  <div class="code-editor-container">
    <div class="editor-header">
      <h3>Редактор кода</h3>
    </div>
    <div v-if="error" class="error-banner">
      {{ error }}
    </div>
    
    <div class="editor-body">
      <div class="line-numbers" ref="lineNumbersRef">
        <div v-for="n in lineCount" :key="n" class="line-number">{{ n }}</div>
      </div>
      <textarea
        ref="textareaRef"
        v-model="code"
        class="code-textarea"
        :class="{ active: isActive }"
        placeholder="Редактируйте JSON схемы здесь"
        @focus="isActive = true"
        @blur="handleBlur"
        @keydown.tab="handleTab"
        @keydown.enter.prevent="handleEnter"
        @input="onInput"
        @scroll="syncScroll"
      ></textarea>
    </div>
    
    <!-- Подсказка -->
    <div class="editor-hint" v-if="!isActive && !code">
      Нажмите чтобы начать писать код...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'

const props = defineProps<{
  content: string
  error?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:content', value: string): void
  (e: 'focused'): void
  (e: 'blurred'): void
}>()

// Состояние редактора
const code = ref(props.content ?? '')
const isActive = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const lineNumbersRef = ref<HTMLElement | null>(null)
const lineCount = computed(() => Math.max(1, code.value.split('\n').length))

watch(
  () => props.content,
  (val) => {
    if (val !== code.value) {
      code.value = val ?? ''
    }
  }
)

function onInput(): void {
  emit('update:content', code.value)
}

function syncScroll(): void {
  if (lineNumbersRef.value && textareaRef.value) {
    lineNumbersRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

// Обработчик потери фокуса
function handleBlur(event: FocusEvent): void {
  // Не снимаем активность сразу - ждем клика вне компонента
  setTimeout(() => {
    const relatedTarget = event.relatedTarget as HTMLElement
    if (!textareaRef.value?.contains(relatedTarget)) {
      isActive.value = false
      emit('blurred')
    }
  }, 10)
}

// Обработка Tab для отступов
function handleTab(event: KeyboardEvent): void {
  event.preventDefault()
  const textarea = textareaRef.value
  if (!textarea) return
  
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  
  // Вставляем 2 пробела вместо Tab
  code.value = code.value.substring(0, start) + '  ' + code.value.substring(end)
  const newPos = start + 2

  // Устанавливаем курсор после отступа
  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = newPos
  })

  emit('update:content', code.value)
}

function handleEnter(event: KeyboardEvent): void {
  event.preventDefault()
  const textarea = textareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = code.value

  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const currentLine = value.slice(lineStart, start)
  const baseIndentMatch = currentLine.match(/^\s*/)
  const baseIndent = baseIndentMatch ? baseIndentMatch[0] : ''

  let indent = baseIndent
  const trimmedBefore = currentLine.trimEnd()
  if (trimmedBefore.endsWith('{') || trimmedBefore.endsWith('[')) {
    indent = baseIndent + '  '
  }

  const insert = '\n' + indent
  const newValue = value.slice(0, start) + insert + value.slice(end)
  code.value = newValue
  const newPos = start + insert.length

  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = newPos
  })

  emit('update:content', code.value)
}

// Закрытие редактора при клике вне его
function handleClickOutside(event: MouseEvent): void {
  if (!textareaRef.value?.contains(event.target as Node)) {
    isActive.value = false
  }
}

// Навешиваем обработчик клика вне компонента
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  if (textareaRef.value === document.activeElement) {
    isActive.value = true
    emit('focused')
  }
})

// Убираем обработчик при размонтировании
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

watch(isActive, (active) => {
  if (active) {
    emit('focused')
  }
})
</script>

<style scoped>
.code-editor-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-right: 1px solid #e1e5e9;
  position: relative;
}

.editor-header {
  padding: 16px;
  background: #ebebeb;
  border-bottom: 1px solid #e1e5e9;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.editor-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 16px;
}

.error-banner {
  background: #ffe3e3;
  color: #c0392b;
  padding: 8px 12px;
  border: 1px solid #ffb3b3;
  border-left: 4px solid #c0392b;
  font-size: 12px;
}

.editor-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.line-numbers {
  background: #f3f4f6;
  border-right: 1px solid #e1e5e9;
  padding: 12px 8px 12px 12px;
  color: #8c98a4;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  text-align: right;
  user-select: none;
  overflow: hidden;
}

.line-number {
  height: 21px;
}

.code-textarea {
  flex: 1;
  border: none;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  background: #fafafa;
  transition: all 0.2s ease;
  overflow: auto;
  white-space: pre;
}

.code-textarea.active {
  background: white;
  box-shadow: inset 0 0 0 2px #007bff;
}

.code-textarea:focus {
  background: white;
}

.code-textarea::placeholder {
  color: #6c757d;
  font-style: italic;
}

.editor-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #6c757d;
  text-align: center;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.9);
  padding: 20px;
  border-radius: 8px;
  border: 2px dashed #dee2e6;
}
</style>
