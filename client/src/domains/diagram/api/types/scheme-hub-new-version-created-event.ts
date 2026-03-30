import type { SchemeVersionDto } from '@/domains/schemes'

export interface SchemeHubNewVersionCreatedEvent {
  SchemeId: number
  Version: SchemeVersionDto
}
