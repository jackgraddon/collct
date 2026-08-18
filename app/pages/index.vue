<template>
  <div>
    <!-- Pull to refresh indicator -->
    <div
      class="flex justify-center overflow-hidden transition-all duration-200"
      :style="{ height: pullDistance ? `${pullDistance}px` : ptrRefreshing ? '40px' : '0px' }"
    >
      <div class="flex items-center justify-center py-2">
        <UIcon
          name="i-lucide-refresh-cw"
          :class="{ 'animate-spin': ptrRefreshing }"
          class="w-5 h-5 text-muted transition-opacity"
          :style="{ opacity: Math.min((pullDistance || (ptrRefreshing ? 40 : 0)) / 40, 1) }"
        />
      </div>
    </div>
    <!-- New posts banner -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <button
        v-if="newPostCount > 0"
        class="w-full mb-4 py-2 px-4 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
        @click="showNewPosts"
      >
        {{ newPostCount }} new {{ newPostCount === 1 ? 'post' : 'posts' }} — tap to see
      </button>
    </Transition>

    <CollctPostGrid :posts="visiblePosts" v-slot="{ post }">
      <CollctPostGridItem :post-data="post" />
    </CollctPostGrid>

    <div ref="loadMoreTrigger" class="h-10 w-full flex items-center justify-center mt-4">
      <USkeleton v-if="loadingMore" class="h-8 w-32" />
      <p v-else-if="exhausted" class="text-sm text-neutral-400">You're all caught up!</p>
    </div>

    <!-- Upload modal -->
    <CollctUploadModal
      v-model:open="showUploadModal"
      :is-moment="uploadMomentMode"
      @uploaded="onUpload"
    />
  </div>
</template>

<script lang="ts" setup>
import { useIntersectionObserver } from '@vueuse/core'

const { on } = useUploadBus()
const route = useRoute()

// Upload modal state
const showUploadModal = ref(false)
const uploadMomentMode = ref(false)

// Auto-open upload modal for moment notifications
watch(() => route.query.upload, (val) => {
  if (val === 'moment') {
    uploadMomentMode.value = true
    showUploadModal.value = true
    // Clear the query param without triggering navigation
    router.replace({ query: {} })
  }
}, { immediate: true })

const router = useRouter()

// ─── Persistent feed state (survives component destruction) ───────────────────
interface FeedState {
  photos: PostData[]
  nextCursor: number | null
}

const { data: feedState } = await useFetch<FeedState>('/api/photos', {
  query: { limit: 20 },
  key: 'feed',
  getCachedData(key, nuxtApp) {
    if (import.meta.server) return

    const cached = nuxtApp.payload.data[key] || nuxtApp.static.data[key]
    if (cached) return cached

    try {
      const local = localStorage.getItem(key)
      if (local) {
        return JSON.parse(local)
      }
    } catch (e) {
      console.error('Error reading feed from localStorage:', e)
    }
  },
})

watch(feedState, (newVal) => {
  if (import.meta.client && newVal) {
    try {
      localStorage.setItem('feed', JSON.stringify(newVal))
    } catch (e) {
      console.error('Error writing feed to localStorage:', e)
    }
  }
}, { deep: true, immediate: true })

// Buffer for manually appended items (uploads)
const appendedPosts = ref<PostData[]>([])
const loadMoreTrigger = ref(null)
const loadingMore = ref(false)
const checkingForNew = ref(false)

// New posts that arrived since the last visible state
const pendingNewPosts = ref<PostData[]>([])
const newPostCount = computed(() => pendingNewPosts.value.length)

// ─── Pull to refresh ────────────────────────────────────────────────────────
const { pullDistance, refreshing: ptrRefreshing } = usePullToRefresh(async () => {
  pendingNewPosts.value = []
  const fresh = await $fetch<FeedState>('/api/photos', { query: { limit: 20 } })
  if (feedState.value) {
    feedState.value = fresh
  }
})

// Visible posts = pending new + existing feed + appended uploads
const visiblePosts = computed(() => [
  ...appendedPosts.value,
  ...pendingNewPosts.value,
  ...(feedState.value?.photos ?? []),
])

const exhausted = computed(() => feedState.value?.nextCursor === null)

// ─── Check for new posts on every mount (including back-navigation) ──────────
onMounted(async () => {
  await checkForNewPosts()
})

const parseSafeDate = (dateVal: string | Date | null | undefined): Date => {
  if (!dateVal) return new Date()
  if (dateVal instanceof Date) return dateVal
  if (typeof dateVal === 'string') {
    const normalized = dateVal.includes('T') ? dateVal : dateVal.replace(' ', 'T')
    return new Date(normalized)
  }
  return new Date(dateVal)
}

async function checkForNewPosts() {
  if (!feedState.value?.photos.length || checkingForNew.value) return
  checkingForNew.value = true
  try {
    const newest = feedState.value.photos[0]
    if (!newest) return
    const newer = await $fetch<FeedState>('/api/photos', {
      query: { limit: 50, after: parseSafeDate(newest.createdAt).getTime() + 1 },
    })
    if (newer.photos.length) {
      pendingNewPosts.value = newer.photos
    }
  } catch {
    // Silently ignore — we'll check again on next mount
  } finally {
    checkingForNew.value = false
  }
}

function showNewPosts() {
  // Move pending posts into the main feed state
  if (feedState.value && pendingNewPosts.value.length) {
    feedState.value = {
      ...feedState.value,
      photos: [...pendingNewPosts.value, ...feedState.value.photos],
    }
    pendingNewPosts.value = []
  }
}

// ─── Load more (infinite scroll) ─────────────────────────────────────────────
async function loadMore() {
  if (loadingMore.value || !feedState.value?.nextCursor) return
  loadingMore.value = true
  try {
    const result = await $fetch<FeedState>('/api/photos', {
      query: { limit: 20, before: feedState.value.nextCursor },
    })
    if (feedState.value) {
      feedState.value = {
        photos: [...feedState.value.photos, ...result.photos],
        nextCursor: result.nextCursor,
      }
    }
  } finally {
    loadingMore.value = false
  }
}

// ─── Handle manual uploads ───────────────────────────────────────────────────
on((post) => appendedPosts.value.unshift(post))

function onUpload(post: PostData) {
  appendedPosts.value.unshift(post)
  uploadMomentMode.value = false
}

// ─── Intersection observer for infinite scroll ───────────────────────────────
useIntersectionObserver(
  loadMoreTrigger,
  (entries) => {
    const isIntersecting = entries[0]?.isIntersecting
    if (isIntersecting && !loadingMore.value && !exhausted.value) {
      loadMore()
    }
  },
  { threshold: 0.5 },
)
</script>
