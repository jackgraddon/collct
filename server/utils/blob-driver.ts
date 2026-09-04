/**
 * Blob storage abstraction layer.
 *
 * - Vercel: uses hub:blob (NuxtHub)
 * - Docker/self-hosted: uses filesystem (COLLCT_BLOB_DIR)
 *
 * Provides put() and delete() operations with the same API.
 */

import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

function getBlobDir(): string {
  return process.env.COLLCT_BLOB_DIR || '.data/blob'
}

function isFilesystem(): boolean {
  return !!process.env.COLLCT_BLOB_DIR || process.env.BLOB_TYPE === 'fs'
}

export async function putBlob(
  pathname: string,
  data: Buffer | ArrayBuffer | ReadableStream,
  options?: { access?: string; contentType?: string },
): Promise<{ url: string }> {
  if (!isFilesystem()) {
    const { blob } = await import('hub:blob')
    return blob.put(pathname, data, options)
  }

  // Filesystem storage
  const blobDir = getBlobDir()
  const filePath = join(blobDir, pathname)
  const dir = dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  if (data instanceof ReadableStream) {
    const chunks: Uint8Array[] = []
    const reader = data.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }
    const buffer = Buffer.concat(chunks)
    writeFileSync(filePath, buffer)
  } else if (data instanceof ArrayBuffer) {
    writeFileSync(filePath, Buffer.from(data))
  } else {
    writeFileSync(filePath, data)
  }

  return { url: `/api/blob/${pathname}` }
}

export async function deleteBlob(pathname: string): Promise<void> {
  if (!isFilesystem()) {
    const { blob } = await import('hub:blob')
    return blob.delete(pathname)
  }

  // Filesystem storage
  const blobDir = getBlobDir()
  const filePath = join(blobDir, pathname)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
}
