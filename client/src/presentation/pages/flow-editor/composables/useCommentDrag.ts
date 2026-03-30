import type { Ref } from 'vue'

import type { Position } from '@/domains/graph'
import { roundCoord } from '@/domains/editor-document'

type CommentLike = {
  id: string
  position: Position
}

type CommentStoreApi = {
  updateDraft(commentId: string, updates: { position: Position }): void
}

type UseCommentDragOptions<TComment extends CommentLike> = {
  comments: Ref<TComment[]>
  zoom: Ref<number>
  documentStore: CommentStoreApi
}

export function useCommentDrag<TComment extends CommentLike>({
  comments,
  zoom,
  documentStore,
}: UseCommentDragOptions<TComment>) {
  function startCommentDrag(commentId: string, event: MouseEvent): void {
    const comment = comments.value.find(item => item.id === commentId)
    if (!comment) return

    const startMouseX = event.clientX
    const startMouseY = event.clientY
    const startOffsetX = comment.position.x
    const startOffsetY = comment.position.y
    const scale = zoom.value || 1

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startMouseX) / scale
      const deltaY = (moveEvent.clientY - startMouseY) / scale
      documentStore.updateDraft(commentId, {
        position: {
          x: roundCoord(startOffsetX + deltaX),
          y: roundCoord(startOffsetY + deltaY),
        },
      })
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    event.preventDefault()
    event.stopPropagation()
  }

  return {
    startCommentDrag,
  }
}
