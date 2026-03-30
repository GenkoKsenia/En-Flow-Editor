import type { EditorComment } from '../models'

import type { EditorDocumentContext } from './editorDocument.context'

export function createDocumentCommentsUseCases(context: EditorDocumentContext) {
  function createCommentId(): string {
    return `comment-${context.nextCommentId.value++}`
  }

  function addComment(comment: EditorComment): void {
    context.comments.value.push(comment)
  }

  function updateComment(commentId: string, updates: Partial<EditorComment>): void {
    const comment = context.comments.value.find(item => item.id === commentId)
    if (comment) {
      Object.assign(comment, updates)
    }
  }

  function removeComment(commentId: string): void {
    context.comments.value = context.comments.value.filter(comment => comment.id !== commentId)
  }

  return {
    createCommentId,
    addComment,
    updateComment,
    removeComment,
  }
}
