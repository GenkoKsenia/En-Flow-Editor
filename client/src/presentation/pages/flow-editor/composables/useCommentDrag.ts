import type { Ref } from 'vue'

import type { Position } from '@/domains/graph'
import { roundCoord } from '@/domains/diagram'

type CommentLike = {
  id: string
  position: Position
}

type CommentStoreApi = {
  updateCommentPosition(commentId: string, position: Position): void
  commitCommentPosition(commentId: string): void | Promise<void>
}

type UseCommentDragOptions<TComment extends CommentLike> = {
  comments: Readonly<Ref<TComment[]>>
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
      documentStore.updateCommentPosition(commentId, {
        x: roundCoord(startOffsetX + deltaX),
        y: roundCoord(startOffsetY + deltaY),
      })
    }

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      void documentStore.commitCommentPosition(commentId)
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
