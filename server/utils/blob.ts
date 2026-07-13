let cachedToken: any = null
let tokenExpiresAt = 0

async function getDelegationToken() {
  if (process.dev) return null

  const now = Date.now()
  if (cachedToken && now < tokenExpiresAt) return cachedToken

  const { issueSignedToken } = await import('@vercel/blob')
  cachedToken = await issueSignedToken({
    validUntil: now + 60 * 60 * 1000,
    operations: ['get']
  })
  tokenExpiresAt = now + 55 * 60 * 1000
  return cachedToken
}

export async function getBlobUrl(pathname: string): Promise<string> {
  if (process.dev) {
    return `/api/blob/${pathname}`
  }

  const { presignUrl } = await import('@vercel/blob')
  const token = await getDelegationToken()
  const { presignedUrl } = await presignUrl(token, {
    pathname,
    access: 'private',
    operation: 'get',
    validUntil: Date.now() + 60 * 60 * 1000
  })
  return presignedUrl
}
