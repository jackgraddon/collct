declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    name: string
    email: string
    avatarUrl: string | null
    avatarPathname: string | null
    totpEnabled: boolean
  }

  interface UserSession {
    user?: User
    unverifiedUserId?: number
    recoveryUserId?: number
    recoveryScope?: 'passkey_registration'
    loggedInAt?: number
  }
}

export {}
