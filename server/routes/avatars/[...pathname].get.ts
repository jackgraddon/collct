import { blob } from 'hub:blob'

export default defineEventHandler(async (event) => {
    const { pathname } = getRouterParams(event)
    return blob.serve(event, pathname || '')
})