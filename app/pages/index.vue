<template>
  <div>
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
  </div>
</template>

<script lang="ts" setup>
import { useIntersectionObserver } from '@vueuse/core'

const { on } = useUploadBus()

// ─── Persistent feed state (survives component destruction) ───────────────────
interface FeedState {
  photos: PostData[]
  nextCursor: number | null
}

const { data: feedState } = await useFetch<FeedState>('/api/photos', {
  query: { limit: 20 },
  key: 'feed',
})

// Buffer for manually appended items (uploads)
const appendedPosts = ref<PostData[]>([])
const loadMoreTrigger = ref(null)
const loadingMore = ref(false)
const checkingForNew = ref(false)

// New posts that arrived since the last visible state
const pendingNewPosts = ref<PostData[]>([])
const newPostCount = computed(() => pendingNewPosts.value.length)

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

async function checkForNewPosts() {
  if (!feedState.value?.photos.length || checkingForNew.value) return
  checkingForNew.value = true
  try {
    const newest = feedState.value.photos[0]
    if (!newest) return
    const newer = await $fetch<FeedState>('/api/photos', {
      query: { limit: 50, after: new Date(newest.createdAt).getTime() },
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
