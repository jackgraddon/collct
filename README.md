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

## License

Private project (for now).