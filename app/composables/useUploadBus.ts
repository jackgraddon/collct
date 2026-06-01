export function useUploadBus() {
  const nuxtApp = useNuxtApp()

  function emit(post: PostData) {
    nuxtApp.hooks.callHook('collct:photoUploaded' as any, post)
  }

  function on(handler: (post: PostData) => void) {
    nuxtApp.hook('collct:photoUploaded' as any, handler)
  }

  return { emit, on }
}