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

- **Frontend:** Nuxt 4, Vue 3, Nuxt UI
- **Backend:** Nuxt Server API, Drizzle ORM, PostgreSQL
- **Auth:** WebAuthn (passkeys) + TOTP 2FA
- **Storage:** Vercel Blob (private image storage)
- **Deploy:** Vercel

## Configuration

Collct is configured via environment variables. All variables are optional and have sensible defaults.

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

### Authentication

- `COLLCT_REQUIRE_EMAIL_VERIFICATION` — Require email verification before login (default: `"false"`, requires email service integration — not yet implemented)

### Features

- `COLLCT_NOTIFICATIONS_ENABLED` — Enable push notifications (default: `"true"`)
- `COLLCT_COMMENTS_ENABLED` — Enable comments (default: `"true"`)
- `COLLCT_OFFLINE_MODE_ENABLED` — Enable offline caching (default: `"true"`)

### Example

```bash
COLLCT_ALLOW_REGISTRATION=invite-only
COLLCT_INSTANCE_NAME="Family Photos"
COLLCT_ADMIN_EMAIL="dad@family.local"
```

## License

Private project (for now).