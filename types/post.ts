// Types inferred from schema and API responses
import { photos, users } from '@nuxthub/db/schema'

export type Photo = typeof photos.$inferSelect
export type User = typeof users.$inferSelect

export interface PostData {
  id: number
  url: string
  caption: string | null
  createdAt: string
  user: {
    id: number
    name: string
    username: string
    avatarUrl: string | null
  }
}

export type ReactionType = 'thumbs_up' | 'thumbs_down' | 'heart' | 'cry'

export interface ReactionCounts {
  thumbs_up: number
  thumbs_down: number
  heart: number
  cry: number
}

export interface CommentUser {
  id: number
  name: string
  username: string
  avatarUrl: string | null
}

export interface CommentItem {
  id: number
  body: string
  createdAt: string
  user: CommentUser
  reactions: {
    counts: ReactionCounts
    myReaction: ReactionType | null
  }
}

export interface UserSession {
  id: number
  name: string
  username: string
  email: string
  avatarUrl: string | null
}