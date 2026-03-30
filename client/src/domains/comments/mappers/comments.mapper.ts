import type { Position } from '@/domains/graph'

import type { CommentDto, CommentHubRequest } from '../api'
import { buildCommentTargetKey, parseCommentTargetKey, type CommentTargetKey } from '../lib'
import type { CommentTarget, CommentsStoreComment } from '../models'

type RecordLike = Record<string, unknown>

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === 'object' ? value as RecordLike : null
}

function readString(value: unknown, keys: string[]): string | null {
  const record = asRecord(value)
  if (!record) return null

  for (const key of keys) {
    const current = record[key]
    if (typeof current === 'string') {
      return current
    }
  }

  return null
}

function readNumber(value: unknown, keys: string[]): number | null {
  const record = asRecord(value)
  if (!record) return null

  for (const key of keys) {
    const current = record[key]
    if (typeof current === 'number' && Number.isFinite(current)) {
      return current
    }
  }

  return null
}

function normalizeDateTime(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleString('ru-RU')
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toLocaleString('ru-RU')
  }

  return new Date().toLocaleString('ru-RU')
}

function readDateTime(value: unknown, keys: string[]): string {
  const record = asRecord(value)
  if (!record) return normalizeDateTime(null)

  for (const key of keys) {
    const current = record[key]
    if (current != null) {
      return normalizeDateTime(current)
    }
  }

  return normalizeDateTime(null)
}

function buildServerCommentId(serverId: number | null, targetKey: CommentTargetKey, text: string, createdAt: string): string {
  if (serverId !== null) {
    return `comment-${serverId}`
  }

  return `${targetKey}:${createdAt}:${text}`.slice(0, 200)
}

export function mapJoinedCommentPayloadToComment(
  payload: unknown,
  targetKey: CommentTargetKey,
): CommentsStoreComment | null {
  const serverId = readNumber(payload, ['id', 'ID'])
  const text = readString(payload, ['text', 'Text']) ?? ''
  const author = readString(payload, ['user', 'User', 'userID', 'UserID']) ?? ''
  const createdAt = readDateTime(payload, ['dateTime', 'DateTime', 'date', 'Date'])
  const x = readNumber(payload, ['x', 'X']) ?? 0
  const y = readNumber(payload, ['y', 'Y']) ?? 0
  const { type, targetId } = parseCommentTargetKey(targetKey)

  return {
    id: buildServerCommentId(serverId, targetKey, text, createdAt),
    serverId: serverId ?? undefined,
    targetType: type,
    targetId,
    position: { x, y },
    text,
    author,
    createdAt,
    status: 'synced',
  }
}

export function mapJoinedCommentList(payload: unknown, targetKey: CommentTargetKey): CommentsStoreComment[] {
  if (!Array.isArray(payload)) return []

  const unique = new Map<string, CommentsStoreComment>()

  payload.forEach(item => {
    const mapped = mapJoinedCommentPayloadToComment(item, targetKey)
    if (!mapped) return
    unique.set(mapped.id, mapped)
  })

  return Array.from(unique.values())
}

export function inferRefreshTargetKey(
  payload: CommentDto | unknown,
  availableTargets: Iterable<CommentTargetKey>,
): CommentTargetKey | null {
  const elementId = readString(payload, ['elementId', 'ElementId', 'elementID', 'ElementID']) ?? ''
  if (!elementId) return 'canvas'

  const targets = new Set(availableTargets)
  const nodeTarget = buildCommentTargetKey('node', elementId)
  if (targets.has(nodeTarget)) return nodeTarget

  const edgeTarget = buildCommentTargetKey('edge', elementId)
  if (targets.has(edgeTarget)) return edgeTarget

  return null
}

export function mapCommentToHubRequest(
  comment: Pick<CommentsStoreComment, 'targetType' | 'targetId' | 'position' | 'text'>,
  schemeId: number,
): CommentHubRequest {
  const requestBase = {
    schemeId,
    text: comment.text,
    x: comment.position.x,
    y: comment.position.y,
  }

  switch (comment.targetType) {
    case 'node':
      return {
        ...requestBase,
        elementId: comment.targetId ?? '',
        elementtype: 'block',
      }
    case 'edge':
      return {
        ...requestBase,
        elementId: comment.targetId ?? '',
        elementtype: 'connection',
      }
    default:
      return {
        ...requestBase,
        elementId: '',
        elementtype: 'canvas',
      }
  }
}

export function mapCommentToExportPayload(comment: CommentsStoreComment): {
  id: string
  targetId: string | null
  offset: Position
  text: string
  author: string
  createdAt: string
} {
  return {
    id: comment.id,
    targetId: comment.targetType === 'canvas'
      ? 'canvas'
      : `${comment.targetType}:${comment.targetId ?? ''}`,
    offset: { x: comment.position.x, y: comment.position.y },
    text: comment.text,
    author: comment.author,
    createdAt: comment.createdAt,
  }
}
