export interface PostData {
  id: number
  caption: string | null
  url: string
  createdAt: string
  user: {
    id: number
    name: string
    avatarUrl: string | null
  }
}