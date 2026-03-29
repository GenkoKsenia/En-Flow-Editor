<template>
  <div
    class="comment-bubble"
    :style="styleObject"
    @mousedown.stop
    @click.stop
  >
    <div class="comment-meta" @mousedown.left.stop.prevent="onDragHandleMouseDown">
      <span class="comment-author">{{ comment.author }}</span>
      <span class="comment-time">{{ comment.createdAt }}</span>
      <button class="comment-remove" type="button" @click.stop="$emit('remove', comment.id)">
        <X :size="14" />
      </button>
    </div>
    <textarea v-model="comment.text" placeholder="Комментарий"></textarea>
  </div>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'
import type { Position } from '@/types'

type CommentTarget = 'node' | 'edge' | 'canvas'

interface Comment {
  id: string
  /**
   * Encoded target: node:<id>, edge:<id> или canvas
   */
  targetId: string | null
  offset: Position
  text: string
  author: string
  createdAt: string
}

interface Props {
  comment: Comment
  styleObject?: Record<string, string>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  remove: [commentId: string]
  dragStart: [commentId: string, event: MouseEvent]
}>()

function onDragHandleMouseDown(event: MouseEvent): void {
  emit('dragStart', props.comment.id, event)
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

.comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6c757d;
  cursor: move;
  user-select: none;
}

.comment-author {
  font-weight: 700;
  color: #495057;
}

.comment-time {
  font-size: 11px;
}

.comment-remove {
  margin-left: auto;
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #dc3545;
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
</style>
