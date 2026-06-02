declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

export {}