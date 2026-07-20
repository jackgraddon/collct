# Collct API Documentation

## Overview

Collct is a self-hosted, friends-first photo-sharing platform. This document describes the REST API that powers Collct instances. Any client (web, mobile, CLI, bot, etc.) can interact with a Collct instance via this API.

**Base URL:** `https://<instance-url>/api`

**Authentication:** WebAuthn (passkey-based) with encrypted session cookies. Optional TOTP two-factor authentication with recovery codes. API tokens (Bearer) for third-party clients.

**Content Type:** `application/json` for request/response bodies, `multipart/form-data` for file uploads.

**API Version:** `X-API-Version: 1` header is included on all `/api/*` responses.

---

## Authentication

### WebAuthn Registration

**Endpoint:** `POST /webauthn/register`

**Description:** Register a new passkey. If the user is not logged in and the email is new, a new account is created and the user is auto-joined to the Public group. If the user is already logged in, the new credential is added to their existing account. Also supports a recovery flow where a user with a recovery-scoped session can re-register a passkey.

**Request:**

```json
{
  "userName": "jack@example.com",
  "displayName": "Jack"
}
```

- `userName` (required) — email address used as the WebAuthn username. For new users, the local part (before `@`) is derived as the display username. If that's taken, a numeric suffix is appended (e.g. `jack1`).
- `displayName` (optional) — human-readable name. Defaults to the local part of the email.

**Response:**

Returns the standard WebAuthn credential creation options (challenge, rp, user, pubKeyCredParams, authenticatorSelection, etc.) which the client passes to `navigator.credentials.create()`.

On success (after the browser completes the passkey ceremony), the session is set automatically.

**Status codes:**
- `200` — success
- `400` — invalid request, challenge expired, username mismatch with existing session, or username already taken

---

### WebAuthn Authentication (Login)

**Endpoint:** `POST /webauthn/authenticate`

**Description:** Log in with a registered passkey. If TOTP is enabled on the account, a partial session is created and the response includes `mfaRequired: true` — the client must then call `POST /auth/totp/challenge` to complete login.

**Request:**

The client initiates the ceremony by calling this endpoint, which returns a challenge. The client then calls `navigator.credentials.get()` and submits the assertion via the Nuxt WebAuthn handler.

**Response (no MFA):**

```json
{
  "verified": true
}
```

**Response (MFA required):**

```json
{
  "mfaRequired": true
}
```

In both cases, the session cookie is set. For the MFA response, the session only contains `unverifiedUserId`, not a full user object. The client should then call `POST /auth/totp/challenge` to complete login.

**Status codes:**
- `200` — success
- `404` — credential not found

---

### TOTP Setup

**Endpoint:** `POST /auth/totp/setup`

**Description:** Begin TOTP two-factor authentication setup. Generates a new TOTP secret and returns the `otpauth://` URI for the client to render as a QR code. Replaces any previously pending (unverified) setup. Rejects the request if TOTP is already enabled — disable it first.

**Authentication:** Required

**Request:** Empty body

**Response:**

```json
{
  "uri": "otpauth://totp/Collct:jack@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Collct&algorithm=SHA1&digits=6&period=30",
  "secret": "JBSWY3DPEHPK3PXP"
}
```

**Status codes:**
- `200` — success
- `400` — TOTP is already enabled (must disable first)
- `401` — not authenticated

---

### TOTP Verify

**Endpoint:** `POST /auth/totp/verify`

**Description:** Complete TOTP setup by verifying a 6-digit code from the authenticator app. This marks the TOTP secret as verified and enables TOTP on the user's account.

**Authentication:** Required

**Request:**

```json
{
  "token": "123456"
}
```

**Response:**

```json
{ "ok": true }
```

**Status codes:**
- `200` — success
- `400` — invalid code or no pending TOTP setup
- `401` — not authenticated

---

### TOTP Challenge (MFA Login)

**Endpoint:** `POST /auth/totp/challenge`

**Description:** Complete the second factor during login. Must be called after `POST /webauthn/authenticate` returns `mfaRequired: true`. The client submits the 6-digit TOTP code to upgrade the partial session to a full session.

**Authentication:** Partial session required (has `unverifiedUserId`)

**Request:**

```json
{
  "token": "123456"
}
```

**Response:**

```json
{ "ok": true }
```

The session cookie is upgraded to a full user session.

**Status codes:**
- `200` — success
- `400` — invalid code or TOTP not configured
- `401` — no pending MFA challenge

---

### TOTP Disable

**Endpoint:** `POST /auth/totp/disable`

**Description:** Disable TOTP two-factor authentication. Requires either a valid TOTP token or a recovery code to confirm the action.

**Authentication:** Required

**Request:**

```json
{
  "token": "123456"
}
```

Or, using a recovery code:

```json
{
  "recoveryCode": "ABCD-EFGH-IJKL"
}
```

Exactly one of `token` or `recoveryCode` must be provided.

**Response:**

```json
{ "ok": true }
```

**Status codes:**
- `200` — success
- `400` — invalid token/code, or TOTP not enabled
- `401` — not authenticated

---

### API Token Management

API tokens allow third-party clients (mobile apps, CLI tools, bots, etc.) to authenticate with a Collct instance without using WebAuthn, which is origin-bound and cannot work cross-origin.

Tokens are Bearer tokens sent in the `Authorization` header. They have the same permissions as the user who created them.

#### Generate Token

**Endpoint:** `POST /auth/tokens`

**Description:** Create a new API token. Returns the raw token once — store it securely. The token is SHA-256 hashed before storage; the plaintext is never retrievable again.

**Authentication:** Required

**Request:**

```json
{
  "name": "My Mobile App"
}
```

- `name` (required) — human-readable label for the token (1–100 characters)

**Response:**

```json
{
  "id": 1,
  "name": "My Mobile App",
  "token": "ct_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "createdAt": "2026-07-19T10:00:00.000Z"
}
```

⚠️ The `token` field is only returned once. Store it securely — it cannot be retrieved later.

**Rate Limit:** 5 tokens per hour per user.

**Status codes:**
- `200` — success
- `400` — invalid input
- `401` — not authenticated
- `429` — rate limit exceeded

---

#### List Tokens

**Endpoint:** `GET /auth/tokens`

**Description:** List all active (non-revoked) API tokens for the authenticated user. Returns token metadata only — the raw token is never returned.

**Authentication:** Required

**Response:**

```json
{
  "tokens": [
    {
      "id": 1,
      "name": "My Mobile App",
      "createdAt": "2026-07-19T10:00:00.000Z"
    }
  ]
}
```

**Status codes:**
- `200` — success
- `401` — not authenticated

---

#### Revoke Token

**Endpoint:** `DELETE /auth/tokens/:id`

**Description:** Revoke (delete) an API token. The token immediately stops working.

**Authentication:** Required

**Response:**

```json
{ "ok": true }
```

**Status codes:**
- `200` — success
- `401` — not authenticated
- `404` — token not found

---

### Using API Tokens

Include the token in the `Authorization` header as a Bearer token:

```
Authorization: Bearer ct_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The server validates the token on every request. If valid, the request is processed as if the user had an active session cookie. No additional session management is needed on the client side.

**Important:** API tokens bypass WebAuthn/TOTP entirely. If you need to revoke a compromised token, use `DELETE /auth/tokens/:id`.

---

### Device Flow (for CLIs and devices)

The device flow allows headless devices (CLI tools, smart TVs, etc.) to authenticate without a browser. The device shows a code and URL; the user enters the code in a browser to approve.

#### Step 1: Request Device Code

**Endpoint:** `POST /auth/device/code`

**Description:** Initiate the device authorization flow. Returns a device code for the app to poll, and a user code for the user to enter.

**Authentication:** None

**Request:**

```json
{
  "app_name": "My CLI Tool"
}
```

- `app_name` (optional) — display name shown to the user during approval

**Response:**

```json
{
  "device_code": "a1b2c3d4e5f6...",
  "user_code": "ABCD-1234",
  "verification_uri": "https://collct.example/auth/device",
  "verification_uri_complete": "https://collct.example/auth/device?code=ABCD-1234",
  "expires_in": 600,
  "interval": 5
}
```

**Rate Limit:** 10 requests per 15 minutes (per IP).

**Status codes:**
- `200` — success

---

#### Step 2: User Enters Code and Approves

The user opens `verification_uri` (or clicks `verification_uri_complete`) in a browser. If not already signed in, they authenticate via passkey. They then enter the `user_code` and click **Verify Device** to approve.

**Endpoint:** `POST /auth/device/authorize`

**Description:** Approve or deny a device authorization request. Requires an active session (user must be signed in via browser).

**Authentication:** Required

**Request:**

```json
{
  "code": "ABCD-1234",
  "approve": true
}
```

**Response:**

```json
{ "ok": true }
```

**Status codes:**
- `200` — success
- `400` — invalid, expired, or already used code
- `401` — not authenticated

---

#### Step 3: App Polls for Token

**Endpoint:** `POST /auth/device/token`

**Description:** Poll for the result of the device authorization. The app should poll this endpoint every `interval` seconds (default: 5) until the user approves or denies, or the code expires.

**Authentication:** None

**Request:**

```json
{
  "device_code": "a1b2c3d4e5f6..."
}
```

**Response (pending):**

```json
{
  "status": "pending"
}
```

**Response (approved):**

```json
{
  "token": "ct_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "token_type": "Bearer",
  "expires_in": null
}
```

**Rate Limit:** 30 requests per 10 minutes (per IP).

**Status codes:**
- `200` — success (check `status` field)
- `400` — invalid/expired device code, or authorization denied

---

### Browser Redirect Flow (for mobile apps)

The browser redirect flow works like OAuth — the app opens a browser, the user authorizes, and the app receives a token via a callback URL.

#### Step 1: Request Authorization

**Endpoint:** `POST /auth/authorize`

**Description:** Create an authorization request. Returns a URL for the app to open in a browser.

**Authentication:** None

**Request:**

```json
{
  "redirect_uri": "myapp://auth/callback",
  "app_name": "My Mobile App",
  "state": "optional-csrf-token"
}
```

- `redirect_uri` (required) — the URL to redirect to after approval
- `app_name` (optional) — display name shown to the user during approval
- `state` (optional) — opaque state returned with the redirect (for CSRF protection)

**Response:**

```json
{
  "authorize_url": "https://collct.example/auth/authorize?code=xyz789...",
  "code": "xyz789...",
  "expires_in": 600,
  "state": "optional-csrf-token"
}
```

**Status codes:**
- `200` — success

---

#### Step 2: User Authorizes in Browser

The app opens `authorize_url` in a browser. The user signs in with their passkey (if not already signed in) and clicks **Authorize** on the consent page.

**Endpoint:** `POST /auth/authorize/approve`

**Description:** Approve the authorization. Requires an active session.

**Authentication:** Required

**Request:**

```json
{
  "code": "xyz789..."
}
```

**Response:**

```json
{ "ok": true }
```

**Status codes:**
- `200` — success
- `400` — invalid or expired code
- `401` — not authenticated

---

#### Step 3: Exchange Code for Token

**Endpoint:** `POST /auth/token`

**Description:** Exchange an approved authorization code for an API token.

**Authentication:** None

**Request:**

```json
{
  "code": "xyz789..."
}
```

**Response:**

```json
{
  "access_token": "ct_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "token_type": "Bearer",
  "expires_in": null
}
```

**Rate Limit:** 10 requests per 15 minutes (per IP).

**Status codes:**
- `200` — success
- `400` — invalid, expired, or unused code

---

### Recovery Code Generate

**Endpoint:** `POST /auth/recovery/generate`

**Description:** Generate 10 recovery codes for account recovery. Replaces any previously generated codes. Codes are returned once in plaintext and are never stored — only their SHA-256 hashes are kept in the database.

**Authentication:** Required

**Request:** Empty body

**Response:**

```json
{
  "codes": [
    "ABCD-EFGH-IJKL",
    "MNOP-QRST-UVWX",
    "1234-5678-9ABC",
    "DEF0-1234-5678",
    "9ABC-DEF0-1234",
    "5678-9ABC-DEF0",
    "1234-5678-9ABC",
    "DEF0-1234-5678",
    "9ABC-DEF0-1234",
    "5678-9ABC-DEF0"
  ]
}
```

**Status codes:**
- `200` — success
- `401` — not authenticated

---

### Recovery Code Redeem

**Endpoint:** `POST /auth/recovery/redeem`

**Description:** Redeem a recovery code to obtain a recovery-scoped session. This session only permits passkey re-registration (via `POST /webauthn/register`). Used when a user has lost access to all their passkeys and TOTP devices.

**Request:**

```json
{
  "email": "jack@example.com",
  "code": "ABCD-EFGH-IJKL"
}
```

**Response:**

```json
{ "ok": true }
```

A session cookie is set with recovery scope. The client should then call `POST /webauthn/register` to register a new passkey.

**Status codes:**
- `200` — success
- `400` — invalid code or email (uses constant-time response to prevent email enumeration)

---

### Logout

**Endpoint:** `POST /auth/logout`

**Description:** Clear the current session.

**Authentication:** Required

**Response:**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Status codes:**
- `200` — success

---

## User

### Get Current User

**Endpoint:** `GET /user/me`

**Description:** Retrieve the authenticated user's profile.

**Authentication:** Required

**Response:**

```json
{
  "id": 1,
  "name": "Jack",
  "username": "jack",
  "avatarUrl": "https://<presigned-url>/avatars/1-<timestamp>.jpg?...",
  "hasSeenOobe": false
}
```

Note: `avatarUrl` is a presigned blob URL that expires. It is resolved from the stored pathname at response time.

**Status codes:**
- `200` — success
- `401` — not authenticated

---

### Update User Profile

**Endpoint:** `PATCH /user/update`

**Description:** Update the authenticated user's name and email.

**Authentication:** Required

**Request:**

```json
{
  "name": "Jack Graddon",
  "email": "newemail@example.com"
}
```

- `name` (required) — 1–100 characters
- `email` (required) — valid email, max 255 characters

**Response:**

```json
{ "success": true }
```

The session cookie is resealed with the updated values.

**Status codes:**
- `200` — success
- `400` — invalid input
- `401` — not authenticated
- `404` — user not found

---

### Upload Avatar

**Endpoint:** `PATCH /user/avatar`

**Description:** Upload a new profile picture. The previous avatar blob is deleted.

**Authentication:** Required

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Image file (JPEG, PNG, WebP, GIF). Max 2 MB. |

**Response:**

```json
{
  "avatarUrl": "https://<presigned-url>/avatars/1-1720000000000.jpg?..."
}
```

Returns a presigned blob URL (same as `GET /user/me`). The previous avatar is automatically deleted.

**Rate Limit:** 30 uploads per hour per user.

**Status codes:**
- `200` — success
- `400` — no file provided
- `401` — not authenticated
- `413` — file too large (max 2 MB)
- `415` — unsupported file type

---

### Complete OOBE

**Endpoint:** `POST /user/oobe/complete`

**Description:** Mark the out-of-box experience (onboarding tour) as completed for the authenticated user. Idempotent — calling it again has no effect.

**Authentication:** Required

**Request:** Empty body

**Response:**

```json
{ "success": true }
```

**Status codes:**
- `200` — success
- `401` — not authenticated

---

### Get User Profile by Username

**Endpoint:** `GET /users/:username`

**Description:** Retrieve a user's public profile by username. Includes viewer-scoped stats (photo count, comment count) and groups in common with the authenticated user.

**Authentication:** Required

**Response:**

```json
{
  "user": {
    "id": 1,
    "username": "jack",
    "name": "Jack",
    "avatarUrl": "https://<presigned-url>/avatars/1-<timestamp>.jpg?...",
    "createdAt": "2026-01-15T10:00:00.000Z"
  },
  "stats": {
    "photoCount": 42,
    "commentCount": 128,
    "joinedDate": "2026-01-15T10:00:00.000Z"
  },
  "groupsInCommon": [
    {
      "id": 10,
      "name": "The Boys",
      "slug": "the-boys",
      "icon": "👥",
      "color": "#ef4444"
    }
  ]
}
```

- `stats.photoCount` — number of photos by this user that the authenticated user can see (visibility-scoped).
- `stats.commentCount` — total comments by this user (not visibility-scoped).
- `groupsInCommon` — groups both users are members of.

**Status codes:**
- `200` — success
- `400` — missing username
- `401` — not authenticated
- `404` — user not found

---

### Get Photos by User (by Username)

**Endpoint:** `GET /users/:username/photos`

**Description:** Retrieve paginated photos by a specific user (looked up by username). Visibility-filtered — only photos in groups the authenticated user shares with the target user are returned.

**Authentication:** Required

**Query Parameters:**

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 20 | 50 | Number of photos per page |
| `before` | — | — | Cursor (Unix timestamp in milliseconds) |

**Response:**

```json
{
  "photos": [
    {
      "id": 42,
      "caption": "so hot, and respectful.",
      "captionEditedAt": null,
      "captionHistory": [
        {
          "text": "so hot, and respectful.",
          "editedAt": "2026-07-15T12:00:00Z"
        }
      ],
      "createdAt": "2026-07-15T12:00:00.000Z",
      "url": "https://<presigned-url>/photos/1/1720000000000-abc123.jpg?...",
      "user": {
        "id": 1,
        "name": "Jack",
        "avatarUrl": "https://<presigned-url>/avatars/1-<timestamp>.jpg?..."
      },
      "groups": [
        {
          "id": 10,
          "name": "The Boys",
          "icon": "👥",
          "color": "#ef4444"
        }
      ]
    }
  ],
  "nextCursor": 1721040000000
}
```

**Status codes:**
- `200` — success
- `400` — missing username
- `401` — not authenticated
- `404` — user not found

---

## Photos

### Get Photo Feed

**Endpoint:** `GET /photos`

**Description:** Retrieve a paginated feed of photos visible to the authenticated user. Photos are sorted chronologically (newest first) and scoped by group membership — only photos posted to groups the user is a member of are returned.

**Authentication:** Required

**Query Parameters:**

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 20 | 50 | Number of photos per page |
| `before` | — | — | Cursor for backward pagination (Unix timestamp in milliseconds of the oldest photo on the previous page) |
| `after` | — | — | Cursor for forward pagination (Unix timestamp in milliseconds of the newest photo on the previous page) |

**Response:**

```json
{
  "photos": [
    {
      "id": 42,
      "caption": "so hot, and respectful.",
      "captionEditedAt": null,
      "createdAt": "2026-07-15T12:00:00.000Z",
      "url": "https://<presigned-url>/photos/1/1720000000000-abc123.jpg?...",
      "user": {
        "id": 1,
        "name": "Jack",
        "avatarUrl": "https://<presigned-url>/avatars/1-<timestamp>.jpg?..."
      },
      "groups": [
        {
          "id": 10,
          "name": "The Boys",
          "icon": "👥",
          "color": "#ef4444"
        }
      ]
    }
  ],
  "nextCursor": 1721040000000
}
```

- `nextCursor` — a Unix timestamp in milliseconds to pass as `before` for the next page. `null` when there are no more results.
- `url` — presigned blob URL for the photo image.
- `groups` — only includes groups that the viewer is a member of (visibility-filtered).

**Status codes:**
- `200` — success
- `401` — not authenticated

---

### Get Single Photo

**Endpoint:** `GET /photos/:id`

**Description:** Retrieve a single photo by ID. Returns 404 if the user is not a member of any of the photo's groups (visibility filtering).

**Authentication:** Required

**Response:**

```json
{
  "id": 42,
  "caption": "so hot, and respectful.",
  "captionEditedAt": null,
  "captionHistory": [
    {
      "text": "so hot, and respectful.",
      "editedAt": "2026-07-15T12:00:00Z"
    }
  ],
  "blobPathname": "photos/1/1720000000000-abc123.jpg",
  "createdAt": "2026-07-15T12:00:00.000Z",
  "url": "https://<presigned-url>/photos/1/1720000000000-abc123.jpg?...",
  "user": {
    "id": 1,
    "name": "Jack",
    "avatarUrl": "https://<presigned-url>/avatars/1-<timestamp>.jpg?..."
  },
  "groups": [
    {
      "id": 10,
      "name": "The Boys",
      "icon": "👥",
      "color": "#ef4444"
    }
  ]
}
```

- `captionHistory` — present only if the caption has been edited. Array of `{ text, editedAt }` entries in chronological order.

**Status codes:**
- `200` — success
- `400` — invalid photo ID
- `401` — not authenticated
- `404` — photo not found, or user lacks permission to view

---

### Upload Photo

**Endpoint:** `POST /photos`

**Description:** Upload a new photo. Photos are posted to one or more groups (defaults to the Public group). The photo is stored in blob storage and metadata is saved to the database.

**Authentication:** Required

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `photo` | File | Yes | Image file (JPEG, PNG, WebP, GIF). Max 10 MB. |
| `caption` | string | No | Text caption, max 500 characters |
| `groupIds` | string | No | JSON array of group IDs (e.g. `"[10, 11]"`). Defaults to `[publicGroupId]` |

**Response:**

```json
{
  "id": 42,
  "userId": 1,
  "caption": "A caption for the photo",
  "blobPathname": "photos/1/1720000000000-abc123.jpg",
  "createdAt": "2026-07-15T12:00:00.000Z",
  "captionEditedAt": null,
  "captionHistory": null,
  "url": "https://<presigned-url>/photos/1/1720000000000-abc123.jpg?..."
}
```

**Status codes:**
- `200` — success
- `400` — no photo provided
- `401` — not authenticated
- `403` — user is not a member of one or more specified groups
- `413` — file too large (max 10 MB)
- `415` — unsupported file type
- `429` — rate limit exceeded (30 per hour)

---

### Edit Photo Caption

**Endpoint:** `PATCH /photos/:id`

**Description:** Edit a photo's caption. Only the photo owner can edit. Changes are tracked in caption history.

**Authentication:** Required

**Request:**

```json
{
  "caption": "Updated caption"
}
```

- `caption` (required) — max 500 characters. Set to `null` to clear the caption.

**Response:**

```json
{
  "id": 42,
  "userId": 1,
  "caption": "Updated caption",
  "blobPathname": "photos/1/1720000000000-abc123.jpg",
  "createdAt": "2026-07-15T12:00:00.000Z",
  "captionEditedAt": "2026-07-15T13:00:00.000Z",
  "captionHistory": [
    {
      "text": "so hot, and respectful.",
      "editedAt": "2026-07-15T12:00:00Z"
    },
    {
      "text": "Updated caption",
      "editedAt": "2026-07-15T13:00:00Z"
    }
  ]
}
```

**Status codes:**
- `200` — success
- `400` — invalid input
- `401` — not authenticated
- `403` — not the photo owner
- `404` — photo not found

---

### Delete Photo

**Endpoint:** `DELETE /photos/:id`

**Description:** Delete a photo and its associated blob. Only the photo owner can delete.

**Authentication:** Required

**Response:**

```json
{ "success": true }
```

**Status codes:**
- `200` — success
- `400` — invalid photo ID
- `401` — not authenticated
- `403` — not the photo owner
- `404` — photo not found

---

### Get Photos by User (by ID)

**Endpoint:** `GET /photos/user/:userId`

**Description:** Retrieve paginated photos by a specific user (looked up by numeric ID). Visibility-filtered — only photos in groups the authenticated user shares with the target user are returned.

**Authentication:** Required

**Query Parameters:**

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 20 | 50 | Number of photos per page |
| `before` | — | — | Cursor (Unix timestamp in milliseconds) |

**Response:**

```json
{
  "photos": [
    {
      "id": 42,
      "caption": "so hot, and respectful.",
      "captionEditedAt": null,
      "captionHistory": [
        {
          "text": "so hot, and respectful.",
          "editedAt": "2026-07-15T12:00:00Z"
        }
      ],
      "createdAt": "2026-07-15T12:00:00.000Z",
      "url": "https://<presigned-url>/photos/1/1720000000000-abc123.jpg?...",
      "user": {
        "id": 1,
        "name": "Jack",
        "avatarUrl": "https://<presigned-url>/avatars/1-<timestamp>.jpg?..."
      }
    }
  ],
  "nextCursor": 1721040000000
}
```

**Status codes:**
- `200` — success
- `400` — invalid user ID
- `401` — not authenticated

---

## Likes

### Get Likes for a Photo

**Endpoint:** `GET /photos/:id/likes`

**Description:** Retrieve the like status and count for a photo. The count is viewer-scoped — only likes from users who share a group with the viewer are counted. Each viewer sees whether they have liked the photo.

**Authentication:** Required

**Response:**

```json
{
  "liked": true,
  "count": 3
}
```

- `liked` — whether the authenticated user has liked this photo
- `count` — number of viewer-scoped likes (likes from users who share a group with the viewer on this photo).

**Status codes:**
- `200` — success
- `404` — photo not found

---

### Toggle Like

**Endpoint:** `POST /photos/:id/likes`

**Description:** Like or unlike a photo. The request is a toggle — if the user has already liked, it removes the like; otherwise, it adds one.

**Authentication:** Required

**Request:** Empty body

**Response:**

```json
{
  "liked": true,
  "count": 3
}
```

- `liked` — the new state after toggling
- `count` — the viewer-scoped count after toggling.

**Status codes:**
- `200` — success
- `401` — not authenticated
- `404` — photo not found (or user lacks visibility)

---

## Comments

### Get Comments on a Photo

**Endpoint:** `GET /photos/:id/comments`

**Description:** Retrieve comments on a photo. Visibility-filtered — a comment is visible only if the commenter and the viewer share at least one group that the photo is posted to.

**Authentication:** Required

**Response:**

```json
[
  {
    "id": 100,
    "body": "This is fire",
    "editedAt": null,
    "editHistory": null,
    "createdAt": "2026-07-15T12:15:00.000Z",
    "user": {
      "id": 2,
      "name": "Friend",
      "username": "friend",
      "avatarUrl": "https://<presigned-url>/avatars/2-<timestamp>.jpg?..."
    },
    "reactions": {
      "counts": {
        "thumbs_up": 1,
        "thumbs_down": 0,
        "heart": 2,
        "cry": 0
      },
      "myReaction": "heart"
    }
  }
]
```

- Returns an array directly (not wrapped in a `{ comments: [] }` object).
- `editHistory` — present only if the comment has been edited. Array of `{ text, editedAt }` entries.
- `reactions.counts` — per-type counts for this comment.
- `reactions.myReaction` — the authenticated user's current reaction type on this comment, or `null`.

**Status codes:**
- `200` — success (returns `[]` if unauthenticated)

---

### Post a Comment

**Endpoint:** `POST /photos/:id/comments`

**Description:** Add a comment to a photo. The comment is visible only to users who share at least one group with both the photo and the commenter.

**Authentication:** Required

**Request:**

```json
{
  "body": "This is fire"
}
```

- `body` (required) — 1–1000 characters, trimmed.

**Response:**

```json
{
  "id": 100,
  "body": "This is fire",
  "editedAt": null,
  "editHistory": null,
  "createdAt": "2026-07-15T12:15:00.000Z",
  "user": {
    "id": 1,
    "name": "Jack",
    "username": "jack",
    "avatarUrl": "https://<presigned-url>/avatars/1-<timestamp>.jpg?..."
  },
  "reactions": {
    "counts": {
      "thumbs_up": 0,
      "thumbs_down": 0,
      "heart": 0,
      "cry": 0
    },
    "myReaction": null
  }
}
```

**Status codes:**
- `200` — success
- `400` — invalid input (empty body, body too long)
- `401` — not authenticated
- `404` — photo not found (or user lacks visibility)

---

### Edit a Comment

**Endpoint:** `PATCH /comments/:id`

**Description:** Edit a comment. Only the comment author can edit. Changes are tracked in edit history.

**Authentication:** Required

**Request:**

```json
{
  "body": "This is absolutely fire"
}
```

- `body` (required) — 1–1000 characters, trimmed.

**Response:**

```json
{
  "id": 100,
  "body": "This is absolutely fire",
  "editedAt": "2026-07-15T12:20:00.000Z",
  "editHistory": [
    {
      "text": "This is fire",
      "editedAt": "2026-07-15T12:15:00Z"
    },
    {
      "text": "This is absolutely fire",
      "editedAt": "2026-07-15T12:20:00Z"
    }
  ],
  "createdAt": "2026-07-15T12:15:00.000Z",
  "photoId": 42,
  "userId": 1
}
```

**Status codes:**
- `200` — success
- `400` — invalid input
- `401` — not authenticated
- `403` — not the comment author
- `404` — comment not found

---

### Toggle Comment Reaction

**Endpoint:** `POST /comments/:id/reactions`

**Description:** Add, change, or remove a reaction on a comment. Reactions are: `thumbs_up`, `thumbs_down`, `heart`, `cry`.

- If the user has no reaction on this comment, the specified reaction is added.
- If the user already has the same reaction, it is removed (toggle off).
- If the user has a different reaction, it is replaced with the new one.

**Authentication:** Required

**Request:**

```json
{
  "type": "heart"
}
```

- `type` (required) — one of `thumbs_up`, `thumbs_down`, `heart`, `cry`

**Response:**

```json
{
  "counts": {
    "thumbs_up": 1,
    "thumbs_down": 0,
    "heart": 3,
    "cry": 0
  },
  "myReaction": "heart"
}
```

Returns the fresh per-type counts and the user's current reaction on this comment (or `null` if removed).

**Status codes:**
- `200` — toggled (added, replaced, or removed)
- `400` — invalid reaction type
- `401` — not authenticated
- `404` — comment not found (or user lacks visibility)

---

## Groups

### Get User's Groups

**Endpoint:** `GET /groups`

**Description:** Retrieve all groups the authenticated user is a member of, including the user's role in each group.

**Authentication:** Required

**Response:**

```json
{
  "groups": [
    {
      "id": 1,
      "name": "Public",
      "slug": "public",
      "isPublic": true,
      "ownerId": null,
      "icon": null,
      "color": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "role": "member"
    },
    {
      "id": 10,
      "name": "The Boys",
      "slug": "the-boys",
      "isPublic": false,
      "ownerId": 1,
      "icon": "👥",
      "color": "#ef4444",
      "createdAt": "2026-07-15T10:00:00.000Z",
      "role": "owner"
    }
  ]
}
```

- `role` — the authenticated user's role in the group: `owner`, `admin`, or `member`.

**Status codes:**
- `200` — success
- `401` — not authenticated

---

### Get Group Details

**Endpoint:** `GET /groups/:id`

**Description:** Retrieve group details including the full member list. Must be a member of the group to view it.

**Authentication:** Required

**Response:**

```json
{
  "id": 10,
  "name": "The Boys",
  "slug": "the-boys",
  "isPublic": false,
  "ownerId": 1,
  "icon": "👥",
  "color": "#ef4444",
  "createdAt": "2026-07-15T10:00:00.000Z",
  "archivedAt": null,
  "members": [
    {
      "id": 1,
      "userId": 1,
      "role": "owner",
      "joinedAt": "2026-07-15T10:00:00.000Z",
      "username": "jack",
      "name": "Jack",
      "avatarUrl": "https://<presigned-url>/avatars/1-<timestamp>.jpg?..."
    },
    {
      "id": 2,
      "userId": 2,
      "role": "member",
      "joinedAt": "2026-07-15T10:05:00.000Z",
      "username": "friend",
      "name": "Friend",
      "avatarUrl": "https://<presigned-url>/avatars/2-<timestamp>.jpg?..."
    }
  ]
}
```

**Status codes:**
- `200` — success
- `400` — invalid group ID
- `401` — not authenticated
- `404` — group not found, or user is not a member

---

### Create Group

**Endpoint:** `POST /groups`

**Description:** Create a new private group. The authenticated user becomes the owner. The group slug is auto-generated from the name.

**Authentication:** Required

**Request:**

```json
{
  "name": "The Boys",
  "icon": "👥",
  "color": "#ef4444"
}
```

- `name` (required) — 1–50 characters, trimmed
- `icon` (optional) — a single emoji character (max 16 codepoints)
- `color` (optional) — hex color code, e.g. `#3B82F6`

**Response:**

```json
{
  "id": 10,
  "name": "The Boys",
  "slug": "the-boys",
  "isPublic": false,
  "ownerId": 1,
  "icon": "👥",
  "color": "#ef4444",
  "createdAt": "2026-07-15T10:00:00.000Z",
  "archivedAt": null
}
```

**Status codes:**
- `200` — success
- `400` — invalid input (invalid emoji, invalid color, name too long)
- `401` — not authenticated
- `409` — a group with that name (slug) already exists

---

### Update Group

**Endpoint:** `PATCH /groups/:id`

**Description:** Update group metadata. Only the owner or admins can update.

**Authentication:** Required

**Request:**

```json
{
  "name": "The Cool Boys",
  "icon": "😎",
  "color": "#3b82f6"
}
```

Any subset of fields can be provided; omitted fields are not changed. Setting `icon` or `color` to an empty string clears them.

**Response:**

```json
{
  "id": 10,
  "name": "The Cool Boys",
  "slug": "the-boys",
  "isPublic": false,
  "ownerId": 1,
  "icon": "😎",
  "color": "#3b82f6",
  "createdAt": "2026-07-15T10:00:00.000Z",
  "archivedAt": null
}
```

**Status codes:**
- `200` — success
- `400` — invalid input, or no fields to update
- `401` — not authenticated
- `403` — user is not an admin or owner
- `404` — group not found

---

### Delete Group

**Endpoint:** `DELETE /groups/:id`

**Description:** Delete a group. Only the owner can delete. The Public group cannot be deleted. Deleting a group cascades — members and invites are removed, but photos retain their group associations.

**Authentication:** Required

**Response:**

```json
{ "ok": true }
```

**Status codes:**
- `200` — success
- `400` — invalid group ID
- `401` — not authenticated
- `403` — not the group owner, or attempting to delete the Public group
- `404` — group not found

---

### Leave Group

**Endpoint:** `POST /groups/:id/leave`

**Description:** Leave a group. The authenticated user is removed from the group's membership. The owner cannot leave (must transfer ownership or delete instead). The Public group cannot be left.

**Authentication:** Required

**Response:**

```json
{ "ok": true }
```

**Status codes:**
- `200` — success
- `400` — invalid group ID
- `401` — not authenticated
- `403` — user is the owner, or attempting to leave the Public group
- `404` — group not found, or user is not a member

---

### List Group Invites

**Endpoint:** `GET /groups/:id/invites`

**Description:** List all active (non-revoked) invites for a group. Only admins and the owner can view invites.

**Authentication:** Required

**Response:**

```json
{
  "invites": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "groupId": 10,
      "code": "aB3kL9mNpQ",
      "createdBy": 1,
      "maxUses": null,
      "useCount": 2,
      "expiresAt": null,
      "revokedAt": null,
      "createdAt": "2026-07-15T10:30:00.000Z"
    }
  ]
}
```

**Status codes:**
- `200` — success
- `400` — invalid group ID
- `401` — not authenticated
- `403` — user is not an admin or owner

---

### Create Group Invite

**Endpoint:** `POST /groups/:id/invites`

**Description:** Generate an invite code that others can use to join the group. Only admins and the owner can create invites.

**Authentication:** Required

**Request:**

```json
{
  "maxUses": 5,
  "expiresInHours": 72
}
```

- `maxUses` (optional) — maximum number of times this invite can be used; `null` = unlimited
- `expiresInHours` (optional) — hours until the invite expires, max 720 (30 days); `null` = never expires

**Response:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "groupId": 10,
  "code": "aB3kL9mNpQ",
  "createdBy": 1,
  "maxUses": 5,
  "useCount": 0,
  "expiresAt": "2026-07-18T10:30:00.000Z",
  "revokedAt": null,
  "createdAt": "2026-07-15T10:30:00.000Z"
}
```

Share the code with others; they use it to join via `POST /groups/invites/redeem`.

**Status codes:**
- `200` — success
- `400` — invalid input
- `401` — not authenticated
- `403` — user is not an admin or owner

---

### Revoke Group Invite

**Endpoint:** `DELETE /groups/:id/invites/:inviteId`

**Description:** Revoke an invite. Sets `revokedAt` on the invite so it can no longer be redeemed. Only admins and the owner can revoke invites.

**Authentication:** Required

**Response:**

```json
{ "ok": true }
```

**Status codes:**
- `200` — success
- `400` — invalid group ID or invite ID
- `401` — not authenticated
- `403` — user is not an admin or owner
- `404` — invite not found

---

### Redeem Group Invite

**Endpoint:** `POST /groups/invites/redeem`

**Description:** Join a group using an invite code. The authenticated user is added to the group as a member. The user is also auto-joined to the Public group if not already a member.

**Authentication:** Required

**Request:**

```json
{
  "code": "aB3kL9mNpQ"
}
```

- `code` (required) — the invite code

**Response:**

```json
{
  "ok": true,
  "groupId": 10
}
```

**Status codes:**
- `200` — success (user is now a member)
- `400` — invalid input
- `401` — not authenticated
- `409` — user is already a member of this group
- `410` — invite has been revoked, expired, or reached its maximum uses
- `404` — invite not found

---

## Notifications

### Get Notifications

**Endpoint:** `GET /notifications`

**Description:** Retrieve a paginated feed of notifications for the authenticated user. Includes actor info (who triggered the notification), photo thumbnails for photo-related notifications, and read/unread status.

**Authentication:** Required

**Query Parameters:**

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `limit` | 20 | 50 | Number of notifications per page |
| `before` | — | — | Cursor for backward pagination (notification ID) |

**Response:**

```json
{
  "notifications": [
    {
      "id": 1001,
      "type": "like",
      "isRead": false,
      "photoId": 42,
      "commentId": null,
      "groupId": 10,
      "createdAt": "2026-07-15T12:00:00.000Z",
      "actor": {
        "id": 2,
        "name": "Friend",
        "username": "friend",
        "avatarUrl": "https://<presigned-url>/avatars/2-<timestamp>.jpg?..."
      },
      "photoUrl": "https://<presigned-url>/photos/1/1720000000000-abc123.jpg?..."
    }
  ],
  "nextCursor": 1001
}
```

- `type` — notification type (e.g. `"like"`, `"comment"`, `"group_invite"`).
- `photoUrl` — presigned thumbnail URL for the associated photo, if applicable.
- `nextCursor` — notification ID to pass as `before` for the next page. `null` when there are no more results.

**Status codes:**
- `200` — success
- `401` — not authenticated

---

### Get Unread Notification Count

**Endpoint:** `GET /notifications/unread-count`

**Description:** Returns the count of unread notifications for the authenticated user. Useful for badge indicators.

**Authentication:** Required

**Response:**

```json
{
  "count": 5
}
```

**Status codes:**
- `200` — success
- `401` — not authenticated

---

### Mark Notifications Read

**Endpoint:** `PATCH /notifications/read`

**Description:** Mark one or more notifications as read. Can mark specific notifications by ID or mark all unread notifications as read.

**Authentication:** Required

**Request:**

Mark specific notifications:

```json
{
  "ids": [1001, 1002, 1003]
}
```

Or mark all as read:

```json
{
  "all": true
}
```

Exactly one of `ids` or `all: true` must be provided.

**Response:**

```json
{ "ok": true }
```

**Status codes:**
- `200` — success
- `400` — neither `ids` nor `all` provided
- `401` — not authenticated

---

### Get VAPID Public Key

**Endpoint:** `GET /notifications/vapid-key`

**Description:** Returns the VAPID public key needed to subscribe to push notifications. Third-party clients use this key when calling `PushManager.subscribe()` (web) or equivalent platform push APIs.

**Authentication:** None

**Response:**

```json
{
  "vapidPublicKey": "BNcRdreALRFXTkOOUHKyEtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XHh2..."
}
```

**Status codes:**
- `200` — success
- `403` — notifications disabled on this instance
- `503` — VAPID keys not configured

---

### Subscribe to Push Notifications

**Endpoint:** `POST /notifications/subscribe`

**Description:** Register a push notification subscription. The server stores the subscription and uses it to send push notifications via Web Push (VAPID). If the subscription endpoint already exists for this user, it is updated.

**Note:** This endpoint is gated by the `COLLCT_NOTIFICATIONS_ENABLED` config variable. Returns `403` when notifications are disabled on the instance.

**Authentication:** Required

**Request:**

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "auth": "abc123...",
    "p256dh": "def456..."
  }
}
```

- `endpoint` (required) — the push service endpoint URL.
- `keys.auth` (required) — authentication secret.
- `keys.p256dh` (required) — client public key.

**Response:**

```json
{ "success": true }
```

**Status codes:**
- `200` — success
- `400` — invalid subscription object
- `401` — not authenticated
- `403` — notifications disabled on this instance

---

### Unsubscribe from Push Notifications

**Endpoint:** `POST /notifications/unsubscribe`

**Description:** Remove a push notification subscription by endpoint URL.

**Authentication:** Required

**Request:**

```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

- `endpoint` (required) — the push service endpoint URL to remove.

**Response:**

```json
{ "success": true }
```

**Status codes:**
- `200` — success
- `400` — missing endpoint
- `401` — not authenticated

---

## Utility Endpoints

### Get Lorem Posts

**Endpoint:** `GET /lorem/posts`

**Description:** Generate mock post data with random images from Picsum. Intended for development and testing.

**Authentication:** None

**Query Parameters:**

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `count` | 10 | 50 | Number of mock posts to generate |

**Response:**

```json
[
  {
    "id": "0001",
    "author": "Jeff Goldblum",
    "img": "https://picsum.photos/seed/abc123/800/450",
    "width": 800,
    "height": 450
  }
]
```

**Status codes:**
- `200` — success

---

### Get Blob File

**Endpoint:** `GET /blob/*`

**Description:** Serve a blob file by pathname. Only available in development — returns 404 in production. In production, clients should use the presigned URLs returned by other endpoints.

**Authentication:** None

**Status codes:**
- `200` — success (dev only)
- `404` — not found (always in production)

---

### Get Version

**Endpoint:** `GET /version`

**Description:** Returns the database (PostgreSQL) version. Useful for health checks.

**Authentication:** None

**Response:**

```json
{
  "version": "PostgreSQL 16.3 (Neon)"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "statusCode": 400,
  "statusMessage": "Invalid input: caption exceeds 500 characters"
}
```

Some endpoints may also include a `data` object with structured error details.

Common status codes:
- `400` — Bad Request (invalid input, validation error)
- `401` — Unauthorized (not authenticated or invalid session)
- `403` — Forbidden (authenticated but lacks permission)
- `404` — Not Found (resource does not exist or is not visible to requester)
- `409` — Conflict (resource already exists, e.g. already a member)
- `410` — Gone (invite revoked, expired, or exhausted)
- `413` — Payload Too Large (file exceeds size limit)
- `415` — Unsupported Media Type (invalid file type)
- `405` — Method Not Allowed
- `429` — Too Many Requests (rate limit exceeded, includes `data.retryAfter` in seconds)
- `500` — Internal Server Error (unexpected error)

---

## CORS

Cross-Origin Resource Sharing (CORS) is supported for third-party clients. When the `COLLCT_APP_URL` environment variable is set, the server responds with the appropriate CORS headers for requests from allowed origins.

**Configuration:**

Set `COLLCT_APP_URL` to one or more allowed origins (comma-separated):

```
COLLCT_APP_URL=https://my-pwa.vercel.app
COLLCT_APP_URL=https://my-pwa.vercel.app,https://localhost:3000
```

**Headers:**

- `Access-Control-Allow-Origin` — the matched request origin
- `Access-Control-Allow-Credentials: true` — allows cookies and auth headers
- `Access-Control-Allow-Methods` — `GET, POST, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers` — `Authorization, Content-Type`
- `Access-Control-Max-Age: 86400` — preflight cache for 24 hours

**Note:** If `COLLCT_APP_URL` is not set, CORS headers are not added and browsers will block cross-origin requests. This is the default for single-instance deployments where the client is served from the same origin.

---

## API Versioning

All `/api/*` responses include an `X-API-Version` header:

```
X-API-Version: 1
```

This header identifies the API contract version. When breaking changes are introduced in the future, the version number will be incremented. Clients should check this header to ensure compatibility.

The OpenAPI 3.1 specification for the full API is available at `/openapi.yaml` on any running instance.

---

## Notes for Client Developers

### Session Management

- After a successful WebAuthn registration or authentication, the server sets an encrypted session cookie (`nuxt-session`). Clients using the browser rely on this cookie automatically.
- Sessions expire after 30 days of inactivity (configurable via `COLLCT_SESSION_MAX_AGE`).
- If TOTP is enabled, the authentication flow is two-step: WebAuthn → TOTP challenge.

### Visibility & Group Membership

- Photos are only visible to users who are members of at least one of the photo's groups.
- Comments are only visible if the commenter and the viewer share at least one group that the photo is posted to.
- Likes follow the same visibility rule — the count is viewer-scoped (only likes from users who share a group with the viewer are included).
- When querying feeds or user photos, results are automatically filtered by the authenticated user's group membership.
- The Public group is a system group that all users are automatically joined to. It cannot be deleted or left.

### Pagination

Feed and user-photo endpoints support cursor-based pagination:
- `limit` controls page size (default: 20, max: 50).
- `before` is a Unix timestamp in milliseconds. Pass the `nextCursor` from the previous response to get the next page.
- `after` is a Unix timestamp in milliseconds for forward pagination (feed endpoint only).
- `nextCursor` in the response is the timestamp to use for the next page. `null` means no more results.

### Blob Storage

- Image URLs returned by endpoints are presigned Vercel Blob URLs with time-limited delegation tokens (valid for ~1 hour).
- Clients should not cache these URLs long-term; re-fetch them frequently.
- In development, blob URLs are served via the `/api/blob/*` proxy endpoint instead.

### Rate Limiting

Rate limiting is enforced on sensitive endpoints to prevent abuse. Limits are applied per client IP (for unauthenticated endpoints) or per user (for authenticated endpoints).

| Endpoint | Limit | Window |
|----------|-------|--------|
| TOTP verify/challenge | 5 requests | 15 minutes (per IP) |
| Recovery code redeem | 5 requests | 15 minutes (per IP) |
| WebAuthn authenticate | 10 requests | 5 minutes (per IP) |
| API token generation | 5 requests | 1 hour (per user) |
| Photo/avatar upload | 30 requests | 1 hour (per user) |

When a rate limit is exceeded, the server responds with `429 Too Many Requests`:

```json
{
  "statusCode": 429,
  "statusMessage": "Too many requests. Retry after 42s.",
  "data": {
    "retryAfter": 42
  }
}
```

The `data.retryAfter` field indicates the number of seconds until the limit resets.

---

## Example Workflow: Multi-Instance Client

A client that connects to multiple Collct instances would:

1. **User adds an instance URL** (e.g., `https://family.collct.example`) to their account list.
2. **Client authenticates** using one of the third-party auth flows:
   - **Device flow** (CLI, smart TV): App requests a device code, user enters it in a browser.
   - **Browser redirect** (mobile app): App opens a browser for passkey login, receives a token via callback.
3. **Client stores the token** alongside the instance URL.
4. **When switching between instances**, the client uses the appropriate stored token.
5. **The feed is instance-scoped** — switching instances shows a different feed, different groups, different friends.

**For manual setup:** Users can also log into the Collct web UI, go to Settings → API Tokens, and create a token manually to paste into the app.

No federation protocol is needed; each instance is independent, and the client simply multiplexes requests across them.
