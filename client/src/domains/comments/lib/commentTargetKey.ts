import type { CommentTarget } from '../models'

export type CommentTargetKey = 'canvas' | `node:${string}` | `edge:${string}`

export function buildCommentTargetKey(type: CommentTarget, targetId: string | null): CommentTargetKey {
  if (type === 'canvas') return 'canvas'
  return `${type}:${targetId ?? ''}`
}

export function parseCommentTargetKey(targetKey: CommentTargetKey): {
  type: CommentTarget
  targetId: string | null
} {
  if (targetKey === 'canvas') {
    return { type: 'canvas', targetId: null }
  }

  if (targetKey.startsWith('node:')) {
    return { type: 'node', targetId: targetKey.slice('node:'.length) || null }
  }

  return { type: 'edge', targetId: targetKey.slice('edge:'.length) || null }
}
