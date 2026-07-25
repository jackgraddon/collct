let cachedToken: any = null
let tokenExpiresAt = 0

let presignUrlFn: typeof import('@vercel/blob').presignUrl | null = null

async function getPresignUrl() {
  if (!presignUrlFn) {
    const blob = await import('@vercel/blob')
    presignUrlFn = blob.presignUrl
  }
  return presignUrlFn
}

export async function getDelegationToken() {
  if (process.dev || process.env.COLLCT_BLOB_DIR) return null

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
  if (process.dev || process.env.COLLCT_BLOB_DIR) {
    return `/api/blob/${pathname}`
  }

  const presignUrl = await getPresignUrl()
  const token = await getDelegationToken()
  const { presignedUrl } = await presignUrl(token, {
    pathname,
    access: 'private',
    operation: 'get',
    validUntil: Date.now() + 60 * 60 * 1000
  })
  return presignedUrl
}
