// server/routes/avatars/[...pathname].get.ts
export default defineEventHandler(async (event) => {
    const { pathname } = getRouterParams(event)
    return blob.serve(event, pathname)
})
