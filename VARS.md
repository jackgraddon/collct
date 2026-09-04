# Environment Variables

All variables are optional and have sensible defaults. See `.env.example` for a copy-paste starting point.

---

## Infrastructure

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://collct:collct@localhost:5432/collct` | PostgreSQL connection string. Required for Docker/self-hosted. On Vercel, NuxtHub auto-configures via Neon integration. |
| `DATABASE_TYPE` | `postgresql` | Database driver: `postgresql` or `sqlite`. When `sqlite`, uses `SQLITE_PATH`. |
| `SQLITE_PATH` | `./data/collct.db` | Path to SQLite database file. Only used when `DATABASE_TYPE=sqlite`. |
| `NUXT_SESSION_PASSWORD` | `collct-default-session-key-change-me` | Encryption key for session cookies. **Set this for production.** Generate with `openssl rand -hex 32`. |
| `CRON_SECRET` | _(empty)_ | Bearer token for `/api/moments/trigger`. Required for server-side moment computation. Generate with `openssl rand -hex 32`. |
| `COLLCT_BLOB_DIR` | _(none)_ | Local directory for blob storage (photos, avatars). When set, blobs stored on disk instead of Vercel Blob. Required for self-hosted. |

---

## Instance

| Variable | Default | Description |
|----------|---------|-------------|
| `COLLCT_INSTANCE_NAME` | `Collct` | Display name used in emails, page titles, PWA manifest, push notifications. |
| `COLLCT_INSTANCE_DESCRIPTION` | `A friends-first photo sharing app...` | Short description shown in PWA manifest. |
| `COLLCT_ADMIN_EMAIL` | `admin@example.com` | Contact email for instance admin. Shown in VAPID push details and error pages. |
| `COLLCT_APP_URL` | _(none)_ | Public URL of the web app. Used to build OAuth authorize URLs. Only needed if client runs on a different domain than the server. |

---

## Auth & Security

| Variable | Default | Description |
|----------|---------|-------------|
| `COLLCT_SESSION_MAX_AGE` | `2592000` (30 days) | Session lifetime in seconds before re-login is required. |
| `COLLCT_SESSION_SECURE` | `true` in production | Whether session cookies are HTTPS-only. |
| `COLLCT_SESSION_SAME_SITE` | `lax` | Cookie SameSite attribute. Options: `lax`, `strict`, `none`. |
| `COLLCT_ALLOW_REGISTRATION` | `yes` | Registration mode. `yes` = open, `invite-only` = invite link required, `no` = disabled. |
| `COLLCT_REQUIRE_EMAIL_VERIFICATION` | `false` | Whether users must verify email before login. (Email service not yet implemented.) |
| `COLLCT_ALLOWED_ORIGINS` | _(all origins)_ | Comma-separated CORS origins. Supports wildcards: `*collct.ing` matches `collct.ing` and all subdomains (HTTPS only). |

---

## Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `COLLCT_NOTIFICATIONS_ENABLED` | `true` | Enable push notifications. When disabled, subscribe endpoint returns 403. |
| `COLLCT_COMMENTS_ENABLED` | `true` | Enable photo comments. When disabled, comment endpoints return 403. |
| `COLLCT_PUBLIC_GROUP_ENABLED` | `true` | Auto-create Public group and join new users on signup. |
| `COLLCT_OFFLINE_MODE_ENABLED` | `true` | Enable PWA offline caching (service worker + runtime caching). |

---

## Moments (BeReal-style daily capture)

| Variable | Default | Description |
|----------|---------|-------------|
| `COLLCT_MOMENTS_ENABLED` | `false` | Enable Moments feature instance-wide. |
| `COLLCT_MOMENTS_WINDOW_START` | `18:00` | Start of daily window (HH:mm, 24h). Random moment time chosen within this range. |
| `COLLCT_MOMENTS_WINDOW_END` | `20:00` | End of daily window. |
| `COLLCT_MOMENTS_CAPTURE_DURATION` | `300` | Seconds users have to capture and post once notified. |
| `COLLCT_MOMENTS_ALLOW_POST_TO_ALL` | `true` | Allow posting to all moment groups at once. `false` = require per-group selection. |
| `COLLCT_MOMENTS_ALLOW_LIBRARY_FALLBACK` | `false` | Allow photo library selection as fallback. `false` = camera-only on all devices. |
| `COLLCT_NOTIFICATION_RETENTION_DAYS` | `30` | Days to keep dismissed notifications before cleanup. |

---

## Push Notifications

### Web Push (VAPID)

| Variable | Default | Description |
|----------|---------|-------------|
| `VAPID_PUBLIC_KEY` | _(auto-generated)_ | VAPID public key for web push. Auto-generated on first run and stored in DB. |
| `VAPID_PRIVATE_KEY` | _(auto-generated)_ | VAPID private key. Same as above. |

### APNs (iOS native)

All optional. If not configured, APNs subscriptions are stored but notifications are skipped.

| Variable | Default | Description |
|----------|---------|-------------|
| `APNS_KEY_ID` | _(none)_ | Apple Push Notification key ID (from Apple Developer portal). |
| `APNS_TEAM_ID` | _(none)_ | Apple Developer Team ID. |
| `APNS_KEY_PATH` | _(none)_ | Path to `.p8` private key file. Never commit to git. |
| `APNS_BUNDLE_ID` | `com.collct.app` | iOS app bundle ID (used as APNs topic). |
| `APNS_PRODUCTION` | `false` | `true` for APNs production, `false` for sandbox. |

### FCM (Android native)

All optional. If not configured, FCM subscriptions are stored but notifications are skipped.

| Variable | Default | Description |
|----------|---------|-------------|
| `FCM_SERVICE_ACCOUNT` | _(none)_ | Firebase service account JSON — either inline JSON string or file path (starts with `/`). |

---

## Stale / Unused

None found. All documented variables are actively referenced in code.
