/**
 * Runtime migration plugin.
 *
 * When hub.db is not configured at build time (Docker/self-hosted),
 * NuxtHub doesn't run migrations. This plugin runs them at startup
 * by reading the generated SQL migration files and executing them.
 *
 * On Vercel where hub.db IS configured, NuxtHub handles migrations.
 * This plugin is a no-op in that case (all migrations already tracked).
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'

export default defineNitroPlugin(async () => {
  // Skip during prerender/static generation — only run at actual server startup
  if (import.meta.prerender) return

  if (!process.env.DATABASE_URL) {
    console.log('[Collct] No DATABASE_URL — skipping migrations')
    return
  }

  const migrationsDir = join(process.cwd(), 'server/db/migrations/postgresql')
  const journalPath = join(migrationsDir, 'meta/_journal.json')

  if (!existsSync(journalPath)) {
    console.log('[Collct] No migration files found — skipping migrations')
    return
  }

  const journal = JSON.parse(readFileSync(journalPath, 'utf-8'))
  const client = postgres(process.env.DATABASE_URL, { max: 1 })

  try {
    // Create tracking table
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS _hub_migrations (
        "id" integer PRIMARY KEY,
        "name" text,
        "applied_at" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Get applied migrations
    const applied = await client.unsafe(`SELECT name FROM _hub_migrations`)
    const appliedNames = new Set(applied.map((r: any) => r.name))

    // Run pending migrations
    let ran = 0
    for (const entry of journal.entries) {
      if (appliedNames.has(entry.tag)) continue

      const sqlPath = join(migrationsDir, `${entry.tag}.sql`)
      if (!existsSync(sqlPath)) {
        console.warn(`[Collct] Migration file not found: ${entry.tag}.sql`)
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
      console.log(`[Collct] Applied migration: ${entry.tag}`)
    }

    if (ran === 0) {
      console.log('[Collct] Database up to date — no migrations needed')
    } else {
      console.log(`[Collct] Applied ${ran} migration(s)`)
    }
  } catch (err) {
    console.error('[Collct] Migration failed:', err)
    // Don't crash the server — let it start and fail on individual queries
  } finally {
    await client.end()
  }
})
