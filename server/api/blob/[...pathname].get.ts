import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { blob } from 'hub:blob'

export default defineEventHandler(async (event) => {
  const pathname = getRouterParam(event, 'pathname')

  if (!pathname) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  // Local filesystem (Docker / self-hosted)
  if (process.env.COLLCT_BLOB_DIR) {
    const filePath = join(process.env.COLLCT_BLOB_DIR, pathname)
    if (!existsSync(filePath)) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }
    const ext = pathname.split('.').pop() || ''
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
    }
    setResponseHeader(event, 'Content-Type', mimeMap[ext] || 'application/octet-stream')
    setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
    return createReadStream(filePath)
  }

  // Vercel Blob — fetch and stream through our proxy (avoids CORS / presigned URL expiry)
  const file = await blob.head(pathname)

  if (!file) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const response = await blob.get(pathname)

  if (!response) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  setResponseHeader(event, 'Content-Type', file.contentType || 'application/octet-stream')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  return response.blob
})
