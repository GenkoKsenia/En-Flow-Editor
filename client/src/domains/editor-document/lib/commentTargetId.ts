import type { CommentTarget } from '../models'

export type DecodedCommentTargetId = {
  type: CommentTarget
  id: string | null
  normalized: string
}

export function encodeTargetId(type: CommentTarget, id: string | null): string {
  if (type === 'canvas') return 'canvas'
  return `${type}:${id ?? ''}`
}

export function decodeTargetId(
  raw: string | null | undefined,
  fallbackType?: CommentTarget,
  fallbackId?: string | null,
): DecodedCommentTargetId {
  if (typeof raw === 'string') {
    if (raw === 'canvas') return { type: 'canvas', id: null, normalized: 'canvas' }
    if (raw.startsWith('node:')) {
      const id = raw.slice('node:'.length) || null
      return { type: 'node', id, normalized: encodeTargetId('node', id) }
    }
    if (raw.startsWith('edge:')) {
      const id = raw.slice('edge:'.length) || null
      return { type: 'edge', id, normalized: encodeTargetId('edge', id) }
    }

    return { type: 'node', id: raw || null, normalized: encodeTargetId('node', raw || null) }
  }

  if (fallbackType) {
    return {
      type: fallbackType,
      id: fallbackId ?? null,
      normalized: encodeTargetId(fallbackType, fallbackId ?? null),
    }
  }

  return { type: 'canvas', id: null, normalized: 'canvas' }
}
