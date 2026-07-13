export default defineEventHandler((event) => {
  if (process.dev) {
    event.node.req.headers['x-forwarded-proto'] = 'https'
  }
})
