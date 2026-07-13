import { pgTable, pgEnum, index, unique, serial, text, timestamp, integer, boolean, uuid } from 'drizzle-orm/pg-core';

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
);
