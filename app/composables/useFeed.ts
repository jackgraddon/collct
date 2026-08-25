import { useDocumentVisibility } from '@vueuse/core'

interface FeedState {
  photos: PostData[]
  nextCursor: number | null
}

interface UseFeedOptions {
  limit?: number
  pollInterval?: number
}

const globalPhotos = ref<PostData[]>([])
const globalNextCursor = ref<number | null>(null)
let subscriberCount = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let visibilityStopFn: (() => void) | null = null

function startPolling(options: UseFeedOptions) {
  if (pollTimer) return

  const { pollInterval = 10_000 } = options

  const stopPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const startPoll = () => {
    stopPoll()
    pollTimer = setInterval(() => fetchFeedPage(options), pollInterval)
  }

  pollTimer = setInterval(() => fetchFeedPage(options), pollInterval)

  if (import.meta.client) {
    const visibility = useDocumentVisibility()
    const unwatch = watch(visibility, (state) => {
      if (state === 'hidden') {
        stopPoll()
      } else {
        fetchFeedPage(options)
        startPoll()
      }
    })

    onMounted(() => {
      if (visibility.value === 'visible' && !pollTimer) {
        startPoll()
      }
    })

    visibilityStopFn = () => {
      stopPoll()
      unwatch()
    }
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (visibilityStopFn) {
    visibilityStopFn()
    visibilityStopFn = null
  }
}

async function fetchFeedPage(options: UseFeedOptions) {
  try {
    const result = await $fetch<FeedState>('/api/photos', {
      query: { limit: options.limit ?? 20 },
    })
    globalPhotos.value = result.photos
    globalNextCursor.value = result.nextCursor
  } catch {
    // Continue polling even if fetch fails
  }
}

async function fetchMorePosts(options: UseFeedOptions): Promise<boolean> {
  if (globalNextCursor.value === null) return false

  try {
    const result = await $fetch<FeedState>('/api/photos', {
      query: { limit: options.limit ?? 20, before: globalNextCursor.value },
    })
    globalPhotos.value = [...globalPhotos.value, ...result.photos]
    globalNextCursor.value = result.nextCursor
    return true
  } catch {
    return false
  }
}

async function checkForNewPosts(options: UseFeedOptions) {
  if (globalPhotos.value.length === 0) return

  try {
    const newest = globalPhotos.value[0]
    if (!newest) return

    const newestTime = newest.createdAt instanceof Date
      ? newest.createdAt.getTime()
      : new Date(newest.createdAt).getTime()

    const newer = await $fetch<FeedState>('/api/photos', {
      query: { limit: 50, after: newestTime + 1 },
    })
    if (newer.photos.length) {
      globalPhotos.value = [...newer.photos, ...globalPhotos.value]
    }
  } catch {
    // Silently ignore
  }
}

function addPost(post: PostData) {
  globalPhotos.value = [post, ...globalPhotos.value]
}

function removePost(postId: number) {
  globalPhotos.value = globalPhotos.value.filter(p => p.id !== postId)
}

function restorePost(post: PostData, index: number = 0) {
  const current = globalPhotos.value
  globalPhotos.value = [...current.slice(0, index), post, ...current.slice(index)]
}

function updatePostInFeed(postId: number, updates: Partial<PostData>) {
  globalPhotos.value = globalPhotos.value.map(p =>
    p.id === postId ? { ...p, ...updates } : p
  )
}

function findPostIndex(postId: number): number {
  return globalPhotos.value.findIndex(p => p.id === postId)
}

function resetFeed(options: UseFeedOptions) {
  globalPhotos.value = []
  globalNextCursor.value = null
  fetchFeedPage(options)
}

export function useFeed(options: UseFeedOptions = {}) {
  const opts = { limit: 20, pollInterval: 10_000, ...options }

  // Ref-counted lifecycle
  subscriberCount++

  onMounted(() => {
    if (subscriberCount === 1) {
      startPolling(opts)
    }
  })

  onUnmounted(() => {
    subscriberCount--
    if (subscriberCount <= 0) {
      subscriberCount = 0
      stopPolling()
    }
  })

  const photos = computed({
    get: () => globalPhotos.value,
    set: (val: PostData[]) => { globalPhotos.value = val },
  })

  const nextCursor = computed({
    get: () => globalNextCursor.value,
    set: (val: number | null) => { globalNextCursor.value = val },
  })

  const exhausted = computed(() => globalNextCursor.value === null)

  return {
    photos,
    nextCursor,
    exhausted,
    fetchPage: () => fetchFeedPage(opts),
    fetchMore: () => fetchMorePosts(opts),
    checkNew: () => checkForNewPosts(opts),
    reset: () => resetFeed(opts),
    addPost,
    removePost,
    restorePost,
    updatePost: updatePostInFeed,
    findPostIndex,
  }
}
