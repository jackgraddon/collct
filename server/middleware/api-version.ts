export default defineEventHandler((event) => {
  // Only add header to /api/* routes
  const path = getRequestURL(event).pathname
  if (path.startsWith('/api/')) {
    setResponseHeader(event, 'X-API-Version', '1')
  }
})
