# Collct

A friends-first social media designed to connect you to your friends, and that's it.

Want to get started? It's easy! Just click the Deploy with Vercel button below, create a Vercel account if you don't have one, and deploy it for free! If you want to selfhost on your own device, check below for more information.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/jackgraddon/collct)

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

- **Frontend:** Nuxt 4, Vue 3, Nuxt UI
- **Backend:** Nuxt Server API, Drizzle ORM, PostgreSQL
- **Auth:** WebAuthn (passkeys) + TOTP 2FA
- **Storage:** Vercel Blob (Vercel) / Local filesystem (Docker)

## Deployment

### Vercel (Recommended)

The fastest way to get started. Click the deploy button above, or:

1. Fork this repo
2. Import on [vercel.com/new](https://vercel.com/new)
3. Link a [Neon](https://neon.tech) PostgreSQL database from the Vercel dashboard
4. Add Vercel Blob storage from the Vercel dashboard
5. Deploy

### Docker

Run Collct on any server with Docker.

**Quick start:**

```bash
git clone https://github.com/jackgraddon/collct.git
cd collct
cp .env.example .env
# Edit .env — at minimum, set NUXT_SESSION_PASSWORD
docker compose up -d
```

Open `http://localhost:3000`.

**Using a pre-built image from GHCR:**

```yaml
# docker-compose.yml override
services:
  collct:
    image: ghcr.io/jackgraddon/collct:latest
    build: # remove this line to use pre-built image
```

**Configuration:** Copy `.env.example` to `.env` and set at least `NUXT_SESSION_PASSWORD` (generate with `openssl rand -hex 32`). All other variables have sensible defaults. See `.env.example` for the full list.

**Persistent data:** Photos and avatars are stored in a Docker volume (`blobdata`). PostgreSQL data is stored in a separate volume (`pgdata`). Back up both volumes for a complete backup.

**Portainer / GitOps:** Point your stack at the repo. The `docker-compose.yml` builds from source by default. Set environment variables in the Portainer UI or via an `.env` file in the repo root.

## Configuration

Collct is configured via environment variables. All variables are optional and have sensible defaults. See [`.env.example`](.env.example) for the full list with descriptions.

### Registration & Access

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

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

## Security

If you discover a security vulnerability, please see [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## License

[AGPL-3.0](LICENSE)
