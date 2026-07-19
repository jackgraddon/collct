import { createHash, randomBytes } from 'node:crypto'

// ------- Device Flow / Authorization Codes -------

/** Generate a user-facing code in XXXX-XXXX format (8 chars). */
export function generateUserCode(): string {
  const bytes = randomBytes(4).toString('hex').toUpperCase()
  return `${bytes.slice(0, 4)}-${bytes.slice(4, 8)}`
}

/** Generate a device code (high-entropy random string). */
export function generateDeviceCode(): string {
  return randomBytes(32).toString('base64url')
}

/** Hash a device code for storage. */
export function hashDeviceCode(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** Generate an authorization code for the redirect flow. */
export function generateAuthorizationCode(): string {
  return randomBytes(32).toString('base64url')
}

// ------- API Tokens -------
import * as OTPAuth from 'otpauth'
import { getAdminConfig } from './config'

// ------- API Tokens -------

/** Generate a new API token. Returns the raw token (shown once) and its SHA-256 hash (stored in DB). */
export function createApiToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(raw).digest('hex')
  return { raw, hash }
}

/** Hash an API token for lookup. */
export function hashApiToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

// ------- Recovery codes -------

/** Generate N random recovery codes in XXXX-XXXX-XXXX format */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(6).toString('hex').toUpperCase()
    return `${bytes.slice(0, 4)}-${bytes.slice(4, 8)}-${bytes.slice(8, 12)}`
  })
}

/** SHA-256 hash a code for storage. Not bcrypt — codes are high-entropy so fast hash is fine. */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase().replace(/-/g, '')).digest('hex')
}

/** Normalise user input before hashing (strips dashes, uppercases) */
export function normaliseCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-F0-9]/g, '')
}

// ------- TOTP -------

export function createTotpSecret(email: string, issuer?: string) {
  const finalIssuer = issuer || getAdminConfig().instanceName || 'Collct'
  const secret = new OTPAuth.Secret({ size: 20 })
  const totp = new OTPAuth.TOTP({
    issuer: finalIssuer,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })
  return { totp, secret: secret.base32, uri: totp.toString() }
}

export function verifyTotpToken(secretBase32: string, token: string): boolean {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })
  // window: 1 = accepts one period before/after to handle clock drift
  const delta = totp.validate({ token, window: 1 })
  return delta !== null
}
