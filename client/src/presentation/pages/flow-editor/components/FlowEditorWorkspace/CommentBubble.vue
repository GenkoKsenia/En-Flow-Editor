<template>
  <div
    class="comment-bubble"
    :class="{
      'comment-bubble--editable': isEditable,
      'comment-bubble--readonly': !isEditable,
    }"
    :style="styleObject"
    @mousedown.stop
    @click.stop
  >
    <div class="comment-meta" @mousedown.left.stop.prevent="onDragHandleMouseDown">
      <div class="comment-meta-main">
        <span class="comment-author">{{ comment.author }}</span>
        <span class="comment-time">{{ formattedCreatedAt }}</span>
      </div>
      <button
        v-if="props.showDelete"
        class="comment-delete"
        type="button"
        aria-label="Удалить комментарий"
        @click.stop="$emit('delete', comment.id)"
      >
        ×
      </button>
    </div>
    <textarea
      ref="textareaRef"
      :value="comment.text"
      :readonly="!isEditable"
      :disabled="comment.status === 'sending'"
      placeholder="Комментарий"
      @input="onInput"
    />
    <div v-if="isEditable" class="comment-actions">
      <button
        class="comment-action comment-action--ghost"
        type="button"
        :disabled="comment.status === 'sending'"
        @click.stop="$emit('cancel', comment.id)"
      >
        Отмена
      </button>
      <button
        class="comment-action comment-action--primary"
        type="button"
        :disabled="comment.status === 'sending' || !canSave"
        @click.stop="$emit('save', comment.id)"
      >
        Сохранить
      </button>
    </div>
    <div v-if="comment.status === 'sending'" class="comment-status">Отправка...</div>
    <div v-else-if="comment.status === 'error'" class="comment-status comment-status--error">Не удалось отправить</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import type { CommentsStoreComment } from '@/domains/comments'

interface Props {
  comment: CommentsStoreComment
  showDelete?: boolean
  styleObject?: Record<string, string>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  dragStart: [commentId: string, event: MouseEvent]
  'update:text': [commentId: string, text: string]
  save: [commentId: string]
  cancel: [commentId: string]
  delete: [commentId: string]
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isEditable = computed(() => props.comment.status === 'draft' || props.comment.status === 'error')
const canSave = computed(() => props.comment.text.trim().length > 0)
const formattedCreatedAt = computed(() => formatCommentDateTime(props.comment.createdAt))

onMounted(() => {
  if (!isEditable.value) return
  void nextTick(() => textareaRef.value?.focus())
})

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatDate(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${pad(date.getFullYear() % 100)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatCommentDateTime(value: string): string {
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    return formatDate(parsed)
  }

  const trimmed = value.trim()
  const ruMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(?:,|\s)+(\d{1,2}):(\d{2})(?::\d{2}(?:[.,]\d+)?)?$/)
  if (!ruMatch) {
    return value
  }

  const [, day, month, yearRaw, hours, minutes] = ruMatch
  const year = yearRaw.length === 2 ? Number(`20${yearRaw}`) : Number(yearRaw)
  const date = new Date(year, Number(month) - 1, Number(day), Number(hours), Number(minutes))

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return formatDate(date)
}

function onDragHandleMouseDown(event: MouseEvent): void {
  if (!isEditable.value) return
  emit('dragStart', props.comment.id, event)
}

function onInput(event: Event): void {
  if (!isEditable.value) return

  const target = event.target as HTMLTextAreaElement | null
  emit('update:text', props.comment.id, target?.value ?? '')
}
</script>

<style scoped>
.comment-bubble {
  position: absolute;
  min-width: 180px;
  max-width: 260px;
  padding: 8px;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  background: #fffbea;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 12000;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.comment-bubble--readonly {
  background: #fffdf3;
}

.comment-meta {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-right: 24px;
  font-size: 12px;
  color: #6c757d;
  cursor: move;
  user-select: none;
}

.comment-meta-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.comment-bubble--readonly .comment-meta {
  cursor: default;
}

.comment-author {
  font-weight: 700;
  color: #495057;
}

.comment-time {
  font-size: 11px;
}

.comment-delete {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #6c757d;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.comment-delete:hover {
  background: rgba(201, 42, 42, 0.12);
  color: #c92a2a;
}

.comment-bubble textarea {
  width: 100%;
  min-height: 60px;
  border: 1px solid #e1e5ea;
  border-radius: 6px;
  padding: 6px;
  font-size: 13px;
  resize: vertical;
}

.comment-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.comment-action {
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  background: #fff;
}

.comment-action:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.comment-action--ghost {
  color: #495057;
}

.comment-action--primary {
  background: #0f766e;
  border-color: #0f766e;
  color: #fff;
}

.comment-status {
  font-size: 11px;
  color: #6c757d;
}

.comment-status--error {
  color: #c92a2a;
}
</style>
