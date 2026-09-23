/**
 * Client-side image conversion to WebP.
 *
 * Converts uploads to WebP (capped longest edge) before sending to the
 * server, so stored blobs are small without any server-side processing.
 * Runs entirely on-device via canvas — no dependencies, works offline.
 *
 * Fail-soft by design: any error, unsupported input (GIF, HEIC), or a
 * browser without a WebP encoder returns the original file untouched.
 * GIFs are always passed through to preserve animation.
 */

export interface ConvertOptions {
  /** Longest edge cap in px. Images smaller than this are never upscaled. */
  maxDimension?: number
  /** WebP quality 0–1. */
  quality?: number
}

const DEFAULTS = { maxDimension: 2048, quality: 0.85 } as const

/**
 * Convert an image File/Blob to WebP. Returns the original on any failure.
 */
export async function convertToWebp(
  input: File | Blob,
  options: ConvertOptions = {},
): Promise<File | Blob> {
  // Animated GIFs would lose all but the first frame — never touch them.
  if (input.type === 'image/gif') return input

  const { maxDimension, quality } = { ...DEFAULTS, ...options }

  try {
    const bitmap = await createImageBitmap(input)

    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return input
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    )

    // No WebP encoder (old browser) → toBlob falls back to PNG. Keep original.
    if (!blob || blob.type !== 'image/webp') return input

    // Preserve File-ness so FormData uploads keep a filename.
    if (input instanceof File) {
      const name = input.name.replace(/\.[^.]+$/, '') + '.webp'
      return new File([blob], name, { type: 'image/webp' })
    }
    return blob
  } catch {
    // Undecodable input (e.g. HEIC) or any other failure → original.
    return input
  }
}

/**
 * Filename extension matching a blob's MIME type (for multipart filenames).
 */
export function extensionForType(type: string): string {
  return type.split('/')[1]?.replace('jpeg', 'jpg') || 'bin'
}
