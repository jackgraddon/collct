export {}

declare global {
  interface PostData {
    id: number
    caption: string | null
    url: string
    createdAt: string | Date
    user: {
      id: number
      name: string
      avatarUrl: string | null
    }
  }
}