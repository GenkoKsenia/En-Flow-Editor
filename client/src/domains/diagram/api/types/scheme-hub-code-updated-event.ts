import type { SchemeHubCodeRequest } from './scheme-hub-code-request'

export interface SchemeHubCodeUpdatedEvent {
  SchemeId: number
  VersionId: number
  Changes: SchemeHubCodeRequest
  UserSid: string
  Timestamp: string
}
