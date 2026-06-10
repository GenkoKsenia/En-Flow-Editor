export interface SchemeVersionDto {
  id: number
  isReadOnly?: boolean
  date: string
  schemeID: number
  code: unknown
}

export interface SchemeResponseDto {
  id: number
  name: string
  isReadOnly?: boolean
  isFavorite?: boolean
  userID?: string
  versions?: SchemeVersionDto[]
}
