import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  svg: 'image/svg+xml',
}

export default defineEventHandler(async (event) => {
  const pathname = getRouterParam(event, 'pathname')

  if (!pathname) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const ext = pathname.split('.').pop()?.toLowerCase() || ''
  const contentType = MIME_MAP[ext] || 'application/octet-stream'

  // Immutable cache — blob content never changes once written
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setResponseHeader(event, 'Content-Type', contentType)
  setResponseHeader(event, 'Vary', 'Accept-Encoding')

  // Local filesystem (Docker / self-hosted)
  if (process.env.COLLCT_BLOB_DIR) {
    const filePath = join(process.env.COLLCT_BLOB_DIR, pathname)
    if (!existsSync(filePath)) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }
    return createReadStream(filePath)
  }

  // Vercel Blob — proxy through server with stable URL and cache headers
  try {
    const presignedUrl = await getPresignedBlobUrl(pathname)
    const res = await fetch(presignedUrl)

    if (!res.ok) {
      throw createError({ statusCode: res.status, statusMessage: 'Blob not found' })
    }

    const body = res.body
    if (!body) {
      throw createError({ statusCode: 500, statusMessage: 'Empty blob response' })
    }

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Vary': 'Accept-Encoding',
      },
    })
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({ statusCode: 500, statusMessage: `Blob fetch failed: ${err.message}` })
  }
})
