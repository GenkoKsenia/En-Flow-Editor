<template>
  <div class="code-editor-container">
    <div class="editor-header">
      <h3>Редактор кода</h3>
      <button 
        class="run-btn"
        @click="runCode"
        :disabled="!code.trim()"
      >
        Построить
      </button>
    </div>
    
    <!-- Текстовое поле для кода -->
    <textarea
      ref="textareaRef"
      v-model="code"
      class="code-textarea"
      :class="{ active: isActive }"
      placeholder="Введите код здесь...
Например: 
node1 -> node2
node2 -> node3"
      @focus="isActive = true"
      @blur="handleBlur"
      @keydown.tab="handleTab"
    ></textarea>
    
    <!-- Подсказка -->
    <div class="editor-hint" v-if="!isActive && !code">
      Нажмите чтобы начать писать код...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// Состояние редактора
const code = ref('')
const isActive = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// Запуск кода (пока просто логируем)
function runCode(): void {
  console.log('Запускаем код:', code.value)
  // Здесь будет логика парсинга и создания узлов
}

// Обработчик потери фокуса
function handleBlur(event: FocusEvent): void {
  // Не снимаем активность сразу - ждем клика вне компонента
  setTimeout(() => {
    const relatedTarget = event.relatedTarget as HTMLElement
    if (!textareaRef.value?.contains(relatedTarget)) {
      isActive.value = false
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
  
  // Устанавливаем курсор после отступа
  textarea.selectionStart = textarea.selectionEnd = start + 2
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
})

// Убираем обработчик при размонтировании
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
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
  padding: 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #e1e5e9;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.editor-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 16px;
}

.run-btn {
  padding: 8px 16px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.run-btn:hover:not(:disabled) {
  background: #218838;
}

.run-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.code-textarea {
  flex: 1;
  border: none;
  padding: 15px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  background: #fafafa;
  transition: all 0.2s ease;
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