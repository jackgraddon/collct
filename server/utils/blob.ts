import { issueSignedToken } from '@vercel/blob'

// We store these globally in the server instance to persist across requests
let cachedToken: any = null
let tokenExpiresAt = 0

export async function getDelegationToken() {
  const now = Date.now()
  
  // Return the cached token if it is still valid
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken
  }
  
  // Ask Vercel for a short-lived token valid for wildcard pathnames
  cachedToken = await issueSignedToken({
    validUntil: now + 60 * 60 * 1000, // Token valid for 1 hour
    operations: ['get'] // Only allow read access
  })
  
  // Refresh 5 minutes early to prevent expiration overlap during a request
  tokenExpiresAt = now + 55 * 60 * 1000 
  return cachedToken
}