export interface CommentDto {
  id: number
  schemeId: number
  elementId: string
  user: string
  creationDate: string
  text: string
  completionDate: string | null
  x: number
  y: number
}
