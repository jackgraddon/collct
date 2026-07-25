export default defineEventHandler((event) => {
  if (event.path?.startsWith('/api/')) {
    const origin = getRequestHeader(event, 'origin')
    const allowedOrigins = process.env.COLLCT_ALLOWED_ORIGINS?.split(',').map(o => o.trim())

    if (!allowedOrigins || (origin && allowedOrigins.includes(origin))) {
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
