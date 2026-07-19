import { pgTable, pgEnum, index, unique, uniqueIndex, serial, text, timestamp, integer, boolean, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  avatarUrl: text('avatar_url'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  recoveryCodesGeneratedAt: timestamp('recovery_codes_generated_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { mode: 'date' }),
  toursCompleted: text('tours_completed').default('[]'),
});

// Security and Authentication

export const recoveryCodes = pgTable('recovery_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  usedAt: timestamp('used_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const credentials = pgTable('credentials', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  backedUp: boolean('backed_up').notNull().default(false),
  transports: text('transports'), 
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const totpSecrets = pgTable('totp_secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  secret: text('secret').notNull(),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  enabledAt: timestamp('enabled_at', { mode: 'date' }),
});


// Post Data

export const photos = pgTable('photos', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  blobPathname: text('blob_pathname').notNull(),
  caption: text('caption'),
  captionHistory: text('caption_history').default('[]'),
  captionEditedAt: timestamp('caption_edited_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const likes = pgTable(
  'likes',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    photoId: integer('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    unique('likes_user_photo_unique').on(t.userId, t.photoId),
    index('likes_photo_id_idx').on(t.photoId),
  ],
);

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    photoId: integer('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    editHistory: text('edit_history').default('[]'),
    editedAt: timestamp('edited_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('comments_photo_id_idx').on(t.photoId),
  ],
);

export const reactionTypeEnum = pgEnum('reaction_type', [
  'thumbs_up',
  'thumbs_down',
  'heart',
  'cry',
]);
 
export const commentReactions = pgTable(
  'comment_reactions',
  {
    id: serial('id').primaryKey(),
    commentId: integer('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // One reaction type per user per comment — toggle by re-POSTing
    type: reactionTypeEnum('type').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    // A user can only hold one reaction per comment (last one wins via upsert)
    unique('comment_reactions_user_comment_unique').on(t.userId, t.commentId),
    index('comment_reactions_comment_id_idx').on(t.commentId),
  ],
)

// Notifications

export const notificationTypeEnum = pgEnum('notification_type', [
  'like',
  'comment',
  'group_join',
])

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: integer('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    photoId: integer('photo_id').references(() => photos.id, { onDelete: 'cascade' }),
    commentId: integer('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
    groupId: integer('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_user_id_idx').on(t.userId),
    index('notifications_user_read_idx').on(t.userId, t.isRead),
  ],
)

// Groups & Visibility

export const groupRoleEnum = pgEnum('group_role', ['owner', 'admin', 'member'])

export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  icon: text('icon'),
  color: text('color'),
  isPublic: boolean('is_public').notNull().default(false),
  ownerId: integer('owner_id').references(() => users.id),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { mode: 'date' }),
})

export const groupMembers = pgTable(
  'group_members',
  {
    id: serial('id').primaryKey(),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: groupRoleEnum('role').notNull().default('member'),
    joinedAt: timestamp('joined_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    unique('group_members_group_user_unique').on(t.groupId, t.userId),
    index('group_members_user_group_idx').on(t.userId, t.groupId),
  ],
)

export const groupInvites = pgTable('group_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: integer('group_id')
    .notNull()
    .references(() => groups.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').notNull().default(0),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  revokedAt: timestamp('revoked_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

export const photoGroups = pgTable(
  'photo_groups',
  {
    id: serial('id').primaryKey(),
    photoId: integer('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
  },
  (t) => [
    unique('photo_groups_photo_group_unique').on(t.photoId, t.groupId),
    index('photo_groups_group_photo_idx').on(t.groupId, t.photoId),
    index('photo_groups_photo_idx').on(t.photoId),
  ],
)

// API Tokens (for third-party client authentication)

export const apiTokens = pgTable('api_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { mode: 'date' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
})

// Pending Authorizations (device flow + browser redirect flow)

export const pendingAuthorizations = pgTable('pending_authorizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'device' | 'authorization_code'
  userCode: text('user_code').unique(), // device flow only: displayed to user
  deviceCodeHash: text('device_code_hash').unique(), // device flow only: polled by app
  authorizationCode: text('authorization_code').unique(), // redirect flow only: exchanged for token
  appName: text('app_name'), // display name of the requesting app
  redirectUri: text('redirect_uri'), // redirect flow only
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'denied' | 'expired'
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  approvedAt: timestamp('approved_at', { mode: 'date' }),
})

// Push Subscriptions

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    authKey: text('auth_key').notNull(),
    p256dhKey: text('p256dh_key').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('idx_push_subscription_unique').on(t.userId, t.endpoint),
  ],
)
