import { pgTable, serial, text, timestamp, integer, boolean, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { mode: 'date' }),
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

export const photos = pgTable('photos', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  blobPathname: text('blob_pathname').notNull(),
  caption: text('caption'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});