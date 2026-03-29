export interface SchemeHubCodeRequest {
  blocks?: unknown[]
  dataFlows?: unknown[]
  connections?: unknown[]
  styles?: {
    blocks?: unknown[]
    connections?: unknown[]
  }
}

export interface SchemeHubJoinResponse {
  id: number
  name: string
  isReadOnly?: boolean
  isFavorite?: boolean
  userID?: string
  versions?: unknown[]
}

export interface SchemeHubCodeUpdatedEvent {
  SchemeId: number
  VersionId: number
  Changes: SchemeHubCodeRequest
  UserSid: string
  Timestamp: string
}

export interface SchemeHubChangesSavedEvent {
  SchemeId: number
  VersionId: number
  Timestamp: string
}

export interface SchemeHubElementLockedEvent {
  SchemeId?: number
  ElementType: string
  ElementId: string
}

export interface SchemeHubElementLockedByUserEvent {
  ElementType: string
  ElementId: string
  LockedBy: string
  LockTime: string
}

export interface SchemeHubElementLockAcquiredEvent {
  ElementType: string
  ElementId: string
  LockTime: string
}

export interface SchemeHubNewVersionCreatedEvent {
  SchemeId: number
  Version: unknown
}

export interface SchemeHubRequestUpdatesEvent {
  schemeId: number
}

export interface CommentDto {
  id: number
  version: number
  elementId: string
  user: string
  dateTime: string
  text: string
}

export interface CommentHubRequest {
  schemeId: number
  elementId: string
  elementtype: string
  text: string
  x: number
  y: number
}
