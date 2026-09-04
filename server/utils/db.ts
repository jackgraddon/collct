/**
 * Database abstraction layer.
 *
 * All server code imports `db` and `schema` from this module.
 * - PostgreSQL: used on Vercel and Docker with DATABASE_URL
 * - SQLite: used for lightweight deployments with DATABASE_TYPE=sqlite
 *
 * This module directly creates Drizzle connections — no NuxtHub dependency
 * in server code. The `@nuxthub/core` module is still used for blob storage
 * and other Hub features, but the database is managed here.
 */

import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js/driver'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3/driver'
import postgres from 'postgres'
import Database from 'better-sqlite3'
import { mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import * as schemaModule from '../db/schema'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js/driver'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3/driver'

export const schema = schemaModule

type AnyDb = PostgresJsDatabase<typeof schemaModule> | BetterSQLite3Database<typeof schemaModule>

let _db: AnyDb | null = null

function createDb(): AnyDb {
  if (_db) return _db

  const isVercel = !!process.env.VERCEL
  const dbType = process.env.DATABASE_TYPE || (isVercel ? 'postgresql' : 'postgresql')

  if (dbType === 'sqlite') {
    const dbPath = process.env.SQLITE_PATH || './data/collct.db'
    const dir = dirname(dbPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    _db = drizzleSqlite(sqlite, { schema: schemaModule })
  } else {
    const url = process.env.DATABASE_URL || 'postgresql://collct:collct@localhost:5432/collct'
    const client = postgres(url, { max: 10 })
    _db = drizzlePg(client, { schema: schemaModule })
  }

  return _db
}

// Eagerly initialize on module load (server-side only, safe to block)
export const db: AnyDb = createDb()
