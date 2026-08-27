# Agent Instructions

## Database (NuxtHub)

- **Schema file**: `server/db/schema.ts` (and `server/db/schema/*.ts`)
- **Never write manual SQL migrations** in `server/db/migrations/`
- **Always use NuxtHub CLI** for schema changes:
  1. Edit `server/db/schema.ts`
  2. Run `npx nuxt db generate` — generates migration in `server/db/migrations/postgresql/`
  3. Run `npx nuxt db migrate` — applies to local DB (or `npx nuxt dev` auto-applies)
- **On existing production DB**: apply schema changes via direct SQL (`ALTER TABLE`) since NuxtHub baseline migrations recreate all tables
- **Never commit** `server/db/migrations/postgresql/` or `server/db/migrations/sqlite/` — they're gitignored (generated output)
- **Access DB**: `import { db, schema } from '@nuxthub/db'`

## Build

- Run `npx nuxi build` to verify before committing
