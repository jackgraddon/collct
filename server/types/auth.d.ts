declare module '#auth-utils' {
  interface UserSession {
    user?: User
    unverifiedUserId?: number
    recoveryUserId?: number
    recoveryScope?: 'passkey_registration'
    loggedInAt?: number
  }
}

export {}
