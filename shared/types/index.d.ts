export {}

declare module '#auth-utils' {
  interface User {
    id: number
    name: string
    username: string
    email: string
    avatarUrl: string | null
    totpEnabled: boolean
    hasSeenOobe: boolean
  }
}

declare global {
  type ReactionType = 'thumbs_up' | 'thumbs_down' | 'heart' | 'cry'

  interface ReactionCounts {
    thumbs_up: number
    thumbs_down: number
    heart: number
    cry: number
  }

  interface CommentUser {
    id: number
    name: string
    username: string
    avatarUrl: string | null
  }

  interface CommentItem {
    id: number
    body: string
    editedAt: string | null
    editHistory: Array<{ text: string; editedAt: string }> | null
    createdAt: string
    user: CommentUser
    reactions: {
      counts: ReactionCounts
      myReaction: ReactionType | null
    }
  }

  interface PostData {
    id: number
    caption: string | null
    captionEditedAt: string | null
    captionHistory: Array<{ text: string | null; editedAt: string }> | null
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
    expiresAt: Date | string | null
    revokedAt: Date | string | null
    createdAt: Date | string
  }

  interface Notification {
    id: number
    type: 'like' | 'comment' | 'group_join' | 'new_post'
    isRead: boolean
    photoId: number | null
    commentId: number | null
    groupId: number | null
    createdAt: string
    photoUrl: string | null
    actor: {
      id: number
      name: string
      username: string
      avatarUrl: string | null
    }
  }
}
