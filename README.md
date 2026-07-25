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

### Self-Hosted

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

### Docker

You can also run Collct using Docker with our provided docker-compose.yml file:

```bash
# Clone and navigate to the repository
git clone https://github.com/jackgraddon/collct.git
cd collct

# Start all services (database + app)
docker-compose up -d

# Stop services
docker-compose down
```

The docker-compose.yml file sets up:
- PostgreSQL database with persistent storage
- Collct application container
- All required environment variables configured
- Data persistence for both database and application data

Important: You'll need to generate a session password before running the application:
```bash
openssl rand -hex 32
```

Then set the `NUXT_SESSION_PASSWORD` environment variable in your .env file or directly in the compose file.

Open `http://localhost:3000`.

### Docker

You can run Collct using Docker with the image or with the docker-compose.yml file.

Important: You'll need to generate a session password before running the application:
```bash
openssl rand -hex 32
```

Then set the `NUXT_SESSION_PASSWORD` environment variable in your .env file or directly in the compose file.

#### Compose

Using the docker-compose.yml file:

```bash
# Clone and navigate to the repository
git clone https://github.com/jackgraddon/collct.git
cd collct

# Start all services (database + app)
docker-compose up -d

# Stop services
docker-compose down
```

The docker-compose.yml file sets up:
- PostgreSQL database with persistent storage
- Collct application container
- All required environment variables configured
- Data persistence for both database and application data

#### Image

You can also use the image with your own deployment methods.

```bash
docker pull jackgraddon/collct:latest
```

## Configuration

Collct is configured via environment variables. All variables (excluding one) are optional and have sensible defaults. See [`.env.example`](.env.example) for the full list with descriptions.

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
