<template>
  <div class="code-editor-container">
    <div v-if="error" class="error-banner">
      {{ error }}
    </div>
    
    <div class="editor-body">
      <div class="line-numbers" ref="lineNumbersRef">
        <div v-for="n in lineCount" :key="n" class="line-number">{{ n }}</div>
      </div>
      <div class="editor-surface">
        <div class="highlight-layer" aria-hidden="true">
          <pre
            class="highlight-content"
            :style="contentLayerStyle"
            v-html="highlightedCodeHtml"
          ></pre>
        </div>
        <div
          v-if="autocompleteSuggestion"
          class="autocomplete-overlay"
          aria-hidden="true"
        >
          <div class="autocomplete-content" :style="contentLayerStyle">
            <span class="autocomplete-prefix">{{ autocompletePrefix }}</span><span class="autocomplete-suffix">{{ autocompleteSuggestion }}</span>
          </div>
        </div>
        <textarea
          ref="textareaRef"
          v-model="code"
          class="code-textarea"
          :class="{ active: isActive, 'code-textarea--readonly': props.readOnly }"
          :readonly="props.readOnly"
          placeholder="Редактируйте код схемы здесь"
          @focus="handleFocus"
          @blur="handleBlur"
          @keydown.tab="handleTab"
          @keydown.enter="handleEnter"
          @input="onInput"
          @click="updateSelectionState"
          @keyup="updateSelectionState"
          @select="updateSelectionState"
          @scroll="syncScroll"
        ></textarea>
      </div>
    </div>
    
    <!-- Подсказка -->
    <div class="editor-hint" v-if="!isActive && !code">
      Нажмите, чтобы начать писать код схемы...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'

const DSL_KEYWORDS = [
  'flow',
  'info',
  'color',
  'borderColor',
  'borderWidth',
  'borderRadius',
  'borderStyle',
  'radius',
  'width',
  'height',
  'x',
  'y',
  'label',
  'through',
  'breakpointX',
  'breakpointY',
  'finish',
  'left',
  'right',
  'top',
  'bottom',
] as const

const KEYWORDS_WITH_EQUALS = new Set<string>([
  'info',
  'color',
  'borderColor',
  'borderWidth',
  'borderRadius',
  'borderStyle',
  'radius',
  'width',
  'height',
  'x',
  'y',
  'label',
  'through',
  'breakpointX',
  'breakpointY',
  'finish',
])

const DSL_TOKEN_REGEX = new RegExp(
  [
    /"([^"\\]|\\.)*"?/.source,
    `\\b(?:${DSL_KEYWORDS.join('|')})\\b`,
    /\b-?\d+(?:\.\d+)?\b/.source,
    /=>|[=,[\]{}()]/.source,
  ].join('|'),
  'g'
)

const props = defineProps<{
  content: string
  error?: string | null
  readOnly?: boolean
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
const selectionStart = ref(0)
const selectionEnd = ref(0)
const scrollTop = ref(0)
const scrollLeft = ref(0)
const lineCount = computed(() => Math.max(1, code.value.split('\n').length))

type AutocompleteState = {
  beforeWord: string
  currentWord: string
  suggestion: string
  fullKeyword: string
} | null

type CurrentWordState = {
  beforeWord: string
  currentWord: string
} | null

function getCurrentWordState(): CurrentWordState {
  const beforeCaret = code.value.slice(0, selectionStart.value)
  const wordMatch = beforeCaret.match(/(^|[\s([{,])([A-Za-z][A-Za-z0-9]*)$/)
  const currentWord = wordMatch?.[2]
  if (!currentWord) {
    return null
  }

  return {
    beforeWord: beforeCaret.slice(0, beforeCaret.length - currentWord.length),
    currentWord,
  }
}

const autocompleteState = computed<AutocompleteState>(() => {
  if (!isActive.value) return null
  if (selectionStart.value !== selectionEnd.value) return null

  const wordState = getCurrentWordState()
  if (!wordState) return null

  const { beforeWord, currentWord } = wordState
  const caretEnd = selectionEnd.value
  const nextChar = code.value.charAt(caretEnd)

  if (KEYWORDS_WITH_EQUALS.has(currentWord) && nextChar !== '=') {
    return {
      beforeWord,
      currentWord,
      suggestion: '=',
      fullKeyword: currentWord,
    }
  }

  const matchingKeywords = DSL_KEYWORDS
    .filter(keyword => keyword.startsWith(currentWord) && keyword !== currentWord)
    .sort((left, right) => left.localeCompare(right))

  if (matchingKeywords.length !== 1) {
    return null
  }

  const fullKeyword = matchingKeywords[0]
  const suffix = fullKeyword.slice(currentWord.length)
  return {
    beforeWord,
    currentWord,
    suggestion: KEYWORDS_WITH_EQUALS.has(fullKeyword) ? `${suffix}=` : suffix,
    fullKeyword,
  }
})

const autocompletePrefix = computed(() => {
  const state = autocompleteState.value
  return state ? `${state.beforeWord}${state.currentWord}` : ''
})
const autocompleteSuggestion = computed(() => autocompleteState.value?.suggestion ?? '')
const contentLayerStyle = computed(() => ({
  transform: `translate(${-scrollLeft.value}px, ${-scrollTop.value}px)`,
}))
const highlightedCodeHtml = computed(() => highlightCode(code.value))

watch(
  () => props.content,
  (val) => {
    if (val !== code.value) {
      code.value = val ?? ''
      nextTick(() => updateSelectionState())
    }
  }
)

function onInput(): void {
  updateSelectionState()
  emit('update:content', code.value)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function wrapToken(token: string): string {
  const escapedToken = escapeHtml(token)

  if (token.startsWith('"')) {
    return `<span class="token token-string">${escapedToken}</span>`
  }

  if (DSL_KEYWORDS.includes(token as (typeof DSL_KEYWORDS)[number])) {
    return `<span class="token token-keyword">${escapedToken}</span>`
  }

  if (/^-?\d+(?:\.\d+)?$/.test(token)) {
    return `<span class="token token-number">${escapedToken}</span>`
  }

  return `<span class="token token-operator">${escapedToken}</span>`
}

function highlightCode(value: string): string {
  if (!value) {
    return '&nbsp;'
  }

  let lastIndex = 0
  let result = ''

  for (const match of value.matchAll(DSL_TOKEN_REGEX)) {
    const index = match.index ?? 0
    const token = match[0]
    result += escapeHtml(value.slice(lastIndex, index))
    result += wrapToken(token)
    lastIndex = index + token.length
  }

  result += escapeHtml(value.slice(lastIndex))

  if (value.endsWith('\n')) {
    result += '\n'
  }

  return result
}

function syncScroll(): void {
  if (textareaRef.value) {
    scrollTop.value = textareaRef.value.scrollTop
    scrollLeft.value = textareaRef.value.scrollLeft
  }

  if (lineNumbersRef.value && textareaRef.value) {
    lineNumbersRef.value.scrollTop = textareaRef.value.scrollTop
  }
}

function updateSelectionState(): void {
  const textarea = textareaRef.value
  if (!textarea) return

  selectionStart.value = textarea.selectionStart
  selectionEnd.value = textarea.selectionEnd
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

function handleFocus(): void {
  isActive.value = true
  updateSelectionState()
}

function applyAutocomplete(): boolean {
  const textarea = textareaRef.value
  const state = autocompleteState.value
  if (!textarea || !state) return false

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const newValue = code.value.slice(0, start) + state.suggestion + code.value.slice(end)
  code.value = newValue

  const newPos = start + state.suggestion.length
  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = newPos
    updateSelectionState()
  })

  emit('update:content', code.value)
  return true
}

function applyKeywordEquals(): boolean {
  const textarea = textareaRef.value
  const wordState = getCurrentWordState()
  if (!textarea || !wordState) return false

  const { currentWord } = wordState
  if (!KEYWORDS_WITH_EQUALS.has(currentWord)) return false

  const start = textarea.selectionStart
  const nextChar = code.value.charAt(start)
  if (nextChar === '=') {
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 1
      updateSelectionState()
    })
    return true
  }

  code.value = code.value.slice(0, start) + '=' + code.value.slice(start)
  const newPos = start + 1

  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = newPos
    updateSelectionState()
  })

  emit('update:content', code.value)
  return true
}

// Обработка Tab для отступов
function handleTab(event: KeyboardEvent): void {
  if (props.readOnly) return

  event.preventDefault()
  const textarea = textareaRef.value
  if (!textarea) return

  if (applyAutocomplete()) {
    return
  }

  if (applyKeywordEquals()) {
    return
  }
  
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  
  // Вставляем 2 пробела вместо Tab
  code.value = code.value.substring(0, start) + '  ' + code.value.substring(end)
  const newPos = start + 2

  // Устанавливаем курсор после отступа
  nextTick(() => {
    textarea.selectionStart = textarea.selectionEnd = newPos
    updateSelectionState()
  })

  emit('update:content', code.value)
}

function handleEnter(event: KeyboardEvent): void {
  if (props.readOnly) return

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
    updateSelectionState()
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
    updateSelectionState()
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

.editor-surface {
  position: relative;
  flex: 1;
  min-width: 0;
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
  position: relative;
  z-index: 1;
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  background: transparent;
  color: transparent;
  -webkit-text-fill-color: transparent;
  caret-color: #111;
  transition: all 0.2s ease;
  overflow: auto;
  white-space: pre;
}

.highlight-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.highlight-content {
  margin: 0;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre;
  color: #111;
  min-height: 100%;
  min-width: 100%;
}

.autocomplete-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  overflow: hidden;
  pointer-events: none;
}

.autocomplete-content {
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre;
  color: transparent;
  min-height: 100%;
  min-width: 100%;
}

.autocomplete-prefix {
  color: transparent;
}

.autocomplete-suffix {
  color: rgba(17, 17, 17, 0.28);
}

:deep(.token-keyword) {
  color: #0f6ad8;
}

:deep(.token-string) {
  color: #1a7f37;
}

:deep(.token-number) {
  color: #c26a00;
}

:deep(.token-operator) {
  color: #5c6b7a;
}

.code-textarea.active {
  box-shadow: inset 0 0 0 2px #007bff;
}

.code-textarea--readonly {
  cursor: default;
}

.code-textarea::-webkit-scrollbar,
.line-numbers::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.code-textarea::-webkit-scrollbar-thumb {
  background: #c5cbd3;
  border-radius: 8px;
}

.code-textarea::-webkit-scrollbar-thumb:hover {
  background: #aeb5bf;
}

.code-textarea:focus {
  background: transparent;
}

.code-textarea::selection {
  background: rgba(0, 123, 255, 0.22);
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
