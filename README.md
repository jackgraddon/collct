# Collct

A friends-first social media designed to connect you to your friends, and that's it.

## What is Collct?

Collct is a new kind of social media that puts you and your friends at the center of the show. Gone are annoying ads, suggested content, "people you may know," and all of the annoyances the other guys shove in your face. Collct only shows you, your friends, and their photos. That's it.

### Key Features

- **No Algorithm** — You create what you see, no algorithm pulling the strings behind the scenes.
- **No Tracking** — We save the bare minimum. No habits, no preferences, no targeting, nothing.
- **No Strangers** — Only your friends can see each other's photos. You control who sees your posts.

### Additional Features

- **Groups** — Organize friends into groups with roles (owner, admin, member) and invite codes.
- **Photo Sharing** — Upload photos with captions, likes, comments, and emoji reactions.
- **Passkey Authentication** — Passwordless login via WebAuthn (no passwords to remember).
- **Two-Factor Auth** — Optional TOTP 2FA with recovery codes for extra security.
- **QR Codes** — Generate QR codes for easy group invites.
- **PWA Support** — Installable as a progressive web app on any device.

## Tech Stack

- **Frontend:** Nuxt 4, Nuxt UI
- **Backend:** Nuxt 4, NuxtHub

## Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jackgraddon/collct)

The fastest way to get started is clicking the deploy button above. Just make sure to set the NUXT_SESSION_PASSWORD environment variable or else it will fail to build. You should also make sure the databases for SQL and Blob are created and connected, as the button won't do that for you!

Or if you prefer the manual way:

1. Fork this repo
2. Import on [vercel.com/new](https://vercel.com/new)
3. Link a [Neon](https://neon.tech) PostgreSQL database from the Vercel dashboard
4. Add Vercel Blob storage from the Vercel dashboard
5. Deploy

### Docker (Self-Hosted)

Collct provides a multi-stage Dockerfile and Compose files for self-hosted deployment.

#### Quick Start (PostgreSQL)

```bash
git clone https://github.com/jackgraddon/collct.git
cd collct

# Create your env file
cp .env.example .env
# Edit .env — at minimum, set NUXT_SESSION_PASSWORD (openssl rand -hex 32)

# Start with PostgreSQL
docker compose -f docker/docker-compose.prod.yml up -d

# View logs
docker compose -f docker/docker-compose.prod.yml logs -f app
```

Open `http://localhost:3000`.

#### Lightweight (SQLite)

No external database required — data stored in a Docker volume:

```bash
docker compose -f docker/docker-compose.sqlite.yml up -d
```

#### Environment Variables

At minimum, set these in your `.env` file:

```bash
NUXT_SESSION_PASSWORD=$(openssl rand -hex 32)  # Required
CRON_SECRET=$(openssl rand -hex 32)            # For moments trigger
```

See [VARS.md](VARS.md) for all available variables.

#### Health Check

The app exposes a health check at `GET /api/health`:

```json
{ "ok": true, "timestamp": "2026-09-04T02:54:23.481Z" }
```

Docker health checks are configured automatically in the Dockerfile.

#### Pre-built Image

Images are built automatically on every release and published to both GHCR and Docker Hub:

```bash
# GitHub Container Registry (GHCR)
docker pull ghcr.io/jackgraddon/collct:latest

# Docker Hub
docker pull jackgraddon/collct:latest
```

Pin to a specific version:

```bash
docker pull ghcr.io/jackgraddon/collct:1.1.0
```

### Bare Metal (Self-Hosted)

Install Node.js 20+, then:

```bash
git clone https://github.com/jackgraddon/collct.git
cd collct
pnpm install
cp .env.example .env
# Edit .env — at minimum, set NUXT_SESSION_PASSWORD (openssl rand -hex 32)
pnpm build
pnpm start
```

### Local Development

Requires Docker for the database.

```bash
git clone https://github.com/jackgraddon/collct.git
cd collct
pnpm install
cp .env.example .env
# Edit .env — set NUXT_SESSION_PASSWORD (openssl rand -hex 32)

# Start Postgres
docker compose -f docker-compose.dev.yml up -d

# Run migrations
pnpm db:migrate

# (Optional) Seed test users, groups, and photos
pnpm db:seed:dev

# Start dev server
pnpm dev
```

The `pnpm dev` command automatically starts the Postgres container if it's not running.

If you have a `.env.local` with a `DATABASE_URL` pointing to a remote database (e.g., Neon), override it for local dev:

```bash
DATABASE_URL=postgresql://collct:collct@localhost:5432/collct pnpm dev
```

Open `https://localhost:3000`.

#### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start dev server (auto-starts Postgres) |
| `pnpm build` | Production build |
| `pnpm start` | Run production build |
| `pnpm db:generate` | Generate Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply migrations to local Postgres |
| `pnpm db:seed:dev` | Wipe and recreate test data (users, groups, photos) |
| `npx nuxi typecheck` | Run TypeScript type checking |

#### Project Structure

```
collct/
├── app/                    # Client-side (Vue/Nuxt)
│   ├── components/         # Vue components
│   ├── composables/        # Vue composables (useFeed, usePushNotifications, etc.)
│   ├── layouts/            # Page layouts
│   ├── pages/              # Route pages
│   └── utils/              # Client utilities
├── server/                 # Server-side (Nitro)
│   ├── api/                # API endpoints (auto-routed)
│   ├── db/                 # Schema and migrations
│   ├── middleware/          # Server middleware
│   ├── tasks/              # Background tasks (moments, cleanup)
│   └── utils/              # Server utilities (auth, config, push, blob)
├── modules/                # Nuxt modules
├── public/                 # Static assets
├── shared/                 # Shared types and utilities
├── docker/                 # Docker configs (Dockerfile, Compose, entrypoint)
└── scripts/                # Build/dev scripts (seed, etc.)
```

#### Database Migrations

When you change `server/db/schema.ts`:

```bash
# 1. Generate the migration
npx nuxt db generate

# 2. Apply to local DB
npx nuxt db migrate

# 3. The migration file is gitignored — don't commit it
```

For production (existing database), apply schema changes via direct SQL (`ALTER TABLE`) since NuxtHub baseline migrations recreate all tables.

#### DevTools Panel

When running `pnpm dev`, a **Dev Tools** tab appears in Nuxt DevTools (open with `Shift+Option+D` in the browser). It provides:

- **One-click login** — Log in as `test1`, `test2`, or `test3` without needing a passkey
- **Moments controls** — Open/close/reset the moment window, clear captured-today flags per user

These endpoints are structurally excluded from production builds (the module's `setup()` returns early when `nuxt.options.dev` is false, so no routes are registered).

#### Seed Script

`pnpm db:seed:dev` wipes and recreates test data:

| Resource | Count | Details |
|----------|-------|---------|
| Users | 3 | `test1`, `test2`, `test3` (no passwords — use DevTools login) |
| Groups | 3 | "All Friends", "Close Friends", "Just Us" |
| Photos | 16 | With likes and comments; images cached in `dev/seed-images/` |

#### Code Conventions

- **Server imports**: Use `~~/server/utils/db` for database access (not `@nuxthub/db` directly)
- **Auto-imports**: Server utils in `server/utils/` are auto-imported — no need for explicit imports
- **Env vars**: Document in `VARS.md` and `.env.example` when adding new ones
- **Build check**: Run `npx nuxi build` before committing to verify no errors

## Configuration

Collct is configured via environment variables. All variables (excluding one) are optional and have sensible defaults. See [`.env.example`](.env.example) for the full list with descriptions, or [VARS.md](VARS.md) for detailed documentation.

### Database

- `DATABASE_URL` — PostgreSQL connection string (default: `postgresql://collct:collct@localhost:5432/collct`)
- `DATABASE_TYPE` — `"postgresql"` (default) or `"sqlite"`. When `sqlite`, uses `SQLITE_PATH`.
- `SQLITE_PATH` — Path to SQLite database file (default: `./data/collct.db`). Only used when `DATABASE_TYPE=sqlite`.
- `COLLCT_BLOB_DIR` — Local directory for blob storage. Required for self-hosted (photos stored on disk instead of Vercel Blob).

### Registration & Access

- `NUXT_SESSION_PASSWORD` - `<empty>` (default), use `openssl rand -hex 32` to set this, or authentication will not work.
- `COLLCT_ALLOW_REGISTRATION` — `"yes"` (default), `"invite-only"`, or `"no"`. Controls who can create new accounts.
- `COLLCT_PUBLIC_GROUP_ENABLED` — `"true"` (default) or `"false"`. Whether the Public group exists and users are auto-joined on signup.

### Branding

- `COLLCT_INSTANCE_NAME` — Display name of this instance (default: `"Collct"`)
- `COLLCT_INSTANCE_DESCRIPTION` — Short description of this instance (default: `"A friends-first photo sharing app..."`)
- `COLLCT_ADMIN_EMAIL` — Contact email for instance administrator (default: `"admin@example.com"`)

### Session

- `COLLCT_SESSION_MAX_AGE` — Session lifetime in seconds (default: `2592000` = 30 days)
- `COLLCT_SESSION_SECURE` — Whether session cookies are marked Secure (default: `"true"` in production, `"false"` in development)
- `COLLCT_SESSION_SAME_SITE` — SameSite cookie attribute (default: `"lax"`, can be `"lax" | "strict" | "none"`)

### Features

- `COLLCT_NOTIFICATIONS_ENABLED` — Enable push notifications (default: `"true"`)
- `COLLCT_COMMENTS_ENABLED` — Enable comments (default: `"true"`)
- `COLLCT_OFFLINE_MODE_ENABLED` — Enable offline caching (default: `"true"`)

### Third-Party Client Access

- `COLLCT_ALLOWED_ORIGINS` — Comma-separated list of origins allowed for CORS. By default, all origins are allowed (no config needed). Set this to restrict to specific client domains.
- `COLLCT_APP_URL` — Origin of the Collct web app, used to build authorize URLs. Only needed if the client runs on a different domain than the server.

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## Security

If you discover a security vulnerability, please see [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## License

[AGPL-3.0](LICENSE)
