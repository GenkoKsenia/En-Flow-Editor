import type { SchemeVersion } from './scheme-version'

export interface Scheme {
  id: string
  name: string
  isReadOnly: boolean
  favorite: boolean
  userId: string | null
  versions: SchemeVersion[]
}
