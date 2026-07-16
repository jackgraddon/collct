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
      username: string
      avatarUrl: string | null
    }
    groups?: { id: number; name: string; icon?: string | null; color?: string | null }[]
  }

  interface GroupData {
    id: number
    name: string
    slug: string
    icon?: string | null
    color?: string | null
    isPublic: boolean
    ownerId: number | null
    createdAt: string | Date
    role?: string
    members?: GroupMember[]
  }

  interface GroupMember {
    id: number
    userId: number
    role: string
    joinedAt: string | Date
    username: string
    name: string
    avatarUrl: string | null
  }

  interface GroupInvite {
    id: string
    groupId: number
    code: string
    createdBy: number
    maxUses: number | null
    useCount: number
    expiresAt: string | Date | null
    revokedAt: string | Date | null
    createdAt: string | Date
  }
}