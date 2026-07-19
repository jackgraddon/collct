import { getAdminConfig } from '../utils/config'

export default defineEventHandler((event) => {
  const config = getAdminConfig()
  const origin = config.appUrl

  if (!origin) return

  const requestOrigin = getRequestHeader(event, 'origin')
  const allowedOrigins = origin.split(',').map((o) => o.trim())

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    setResponseHeader(event, 'Access-Control-Allow-Origin', requestOrigin)
    setResponseHeader(event, 'Access-Control-Allow-Credentials', 'true')
    setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
    setResponseHeader(event, 'Access-Control-Allow-Headers', 'Authorization, Content-Type')
    setResponseHeader(event, 'Access-Control-Max-Age', 86400)
  }

  if (event.method === 'OPTIONS') {
    return sendNoContent(event)
  }
})
