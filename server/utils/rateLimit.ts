interface RateLimitEntry {
  count: number
  resetAt: number
}

const buckets = new Map<string, RateLimitEntry>()
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key)
  }
}

export interface RateLimitConfig {
  windowMs: number
  max: number
}

/**
 * Check rate limit for a given key. Returns { ok: true } if allowed,
 * or throws a 429 error if the limit is exceeded.
 *
 * Uses a fixed-window algorithm keyed by the provided string
 * (e.g. IP address, user ID, or a combination).
 */
export function rateLimit(key: string, config: RateLimitConfig): { ok: true; remaining: number } {
  cleanup()

  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs })
    return { ok: true, remaining: config.max - 1 }
  }

  entry.count++

  if (entry.count > config.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    throw createError({
      statusCode: 429,
      statusMessage: `Too many requests. Retry after ${retryAfter}s.`,
      data: { retryAfter },
    })
  }

  return { ok: true, remaining: config.max - entry.count }
}

/** Get client IP from request headers (Vercel sets x-forwarded-for). */
export function getClientIp(event: any): string {
  const header = getRequestHeader(event, 'x-forwarded-for')
  if (header) return header.split(',')[0]!.trim()
  const realIp = getRequestHeader(event, 'x-real-ip')
  return realIp || 'unknown'
}

// Preset configurations for common scenarios
export const RATE_LIMITS = {
  /** TOTP verify/challenge: 5 attempts per 15 minutes */
  totp: { windowMs: 15 * 60 * 1000, max: 5 },
  /** Recovery code redeem: 5 attempts per 15 minutes */
  recovery: { windowMs: 15 * 60 * 1000, max: 5 },
  /** WebAuthn authenticate: 10 attempts per 5 minutes */
  webauthn: { windowMs: 5 * 60 * 1000, max: 10 },
  /** Token generation: 5 per hour */
  tokenCreate: { windowMs: 60 * 60 * 1000, max: 5 },
  /** Photo upload: 30 per hour */
  upload: { windowMs: 60 * 60 * 1000, max: 30 },
} as const
