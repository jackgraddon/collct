export default defineEventHandler(async (event) => {
    const { pathname } = getRouterParams(event)
    return hubBlob().serve(event, pathname || '')
})
