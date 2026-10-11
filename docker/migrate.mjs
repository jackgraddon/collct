#!/usr/bin/env node
/**
 * Standalone migration runner for Docker deployments.
 *
 * Reads NuxtHub-compatible migration SQL files from /app/migrations/postgresql/
 * and applies them using the _hub_migrations tracking table.
 *
 * Usage: node /app/docker/migrate.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.log('[migrate] No DATABASE_URL — skipping')
  process.exit(0)
}

const migrationsDir = '/app/migrations/postgresql'
const journalPath = join(migrationsDir, 'meta/_journal.json')

if (!existsSync(journalPath)) {
  console.log('[migrate] No migration files found — skipping')
  process.exit(0)
}

const postgres = (await import('postgres')).default
const journal = JSON.parse(readFileSync(journalPath, 'utf-8'))
const client = postgres(DATABASE_URL, { max: 1 })

try {
  // Create tracking table (NuxtHub's _hub_migrations)
  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS _hub_migrations (
      "id" integer PRIMARY KEY,
      "name" text,
      "applied_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Get applied migrations
  const applied = await client.unsafe(`SELECT name FROM _hub_migrations`)
  const appliedNames = new Set(applied.map(r => r.name))

  // Run pending migrations
  let ran = 0
  for (const entry of journal.entries) {
    if (appliedNames.has(entry.tag)) continue

    const sqlPath = join(migrationsDir, `${entry.tag}.sql`)
    if (!existsSync(sqlPath)) {
      console.warn(`[migrate] File not found: ${entry.tag}.sql`)
      continue
    }

    const sql = readFileSync(sqlPath, 'utf-8')
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)

    for (const stmt of statements) {
      await client.unsafe(stmt)
    }

    await client.unsafe(
      `INSERT INTO _hub_migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [entry.idx, entry.tag],
    )

    ran++
    console.log(`[migrate] Applied: ${entry.tag}`)
  }

  if (ran === 0) {
    console.log('[migrate] Database up to date')
  } else {
    console.log(`[migrate] Applied ${ran} migration(s)`)
  }
} catch (err) {
  console.error('[migrate] Failed:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
