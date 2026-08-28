function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  try {
    const originHost = new URL(origin).hostname
    return allowedOrigins.some((allowed) => {
      // Wildcard: *example.com matches example.com and all subdomains
      if (allowed.startsWith('*')) {
        const allowedHost = allowed.slice(1)
        return originHost === allowedHost || originHost.endsWith(`.${allowedHost}`)
      }
      // Exact match
      try {
        return originHost === new URL(allowed).hostname
      } catch {
        return origin === allowed
      }
    })
  } catch {
    return false
  }
}

export default defineEventHandler((event) => {
  if (event.path?.startsWith('/api/')) {
    const origin = getRequestHeader(event, 'origin')
    const allowedOrigins = process.env.COLLCT_ALLOWED_ORIGINS?.split(',').map(o => o.trim())

    if (!allowedOrigins || (origin && isOriginAllowed(origin, allowedOrigins))) {
      setResponseHeader(event, 'Access-Control-Allow-Origin', origin || '*')
      setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true')
      setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
      setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization')
      setResponseHeader(event, 'Access-Control-Max-Age', 86400)
    }

    if (event.method === 'OPTIONS') {
      return sendNoContent(event)
    }
  }
})
