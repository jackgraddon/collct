<template>
  <div>
    <CollctPostGrid :posts="allPosts" v-slot="{ post }">
      <CollctPostGridItem :post-data="post" />
    </CollctPostGrid>

    <div ref="loadMoreTrigger" class="h-10 w-full flex items-center justify-center mt-4">
      <USkeleton v-if="status === 'pending'" class="h-8 w-32" />
      <p v-else-if="exhausted" class="text-sm text-neutral-400">You're all caught up!</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useIntersectionObserver } from '@vueuse/core'

const { on } = useUploadBus()
// Keep a buffer for manually appended items (like via the Upload modal)
const appendedPosts = ref<PostData[]>([]) 
const cursor = ref<number | null>(null)
const loadMoreTrigger = ref(null)

const { data, status, error } = await useFetch('/api/photos', {
  key: 'feed-photos', // Essential for SSR/Client hydration
  query: computed(() => ({
    limit: 20,
    ...(cursor.value !== null ? { before: cursor.value } : {}),
  })),
  watch: [cursor],
  lazy: true,
})

// Fix: Derive the grid data directly from the fetch result
const allPosts = computed(() => {
  const fetched = data.value?.photos || []
  return [...appendedPosts.value, ...fetched]
})

const exhausted = computed(() => data.value?.nextCursor === null)

// Handle manual uploads
on((post) => appendedPosts.value.unshift(post))

// Intersection Observer stays the same, but update cursor based on data
useIntersectionObserver(
  loadMoreTrigger,
  (entries) => {
    const isIntersecting = entries[0]?.isIntersecting
    if (isIntersecting && status.value !== 'pending' && !exhausted.value) {
      const last = allPosts.value.at(-1)
      if (last) cursor.value = new Date(last.createdAt).getTime()
    }
  },
  { threshold: 0.5 }
)
</script>
