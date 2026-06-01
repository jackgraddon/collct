<template>
  <div>
    <CollctPostGrid :posts="allPosts" v-slot="{ post }">
      <CollctPostGridItem :post-data="post" />
    </CollctPostGrid>

    <div ref="loadMoreTrigger" class="h-10 w-full flex items-center justify-center mt-4">
      <USkeleton v-if="status === 'pending'" class="h-8 w-32" />
      <p v-else-if="exhausted" class="text-sm text-neutral-400">No more photos</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useIntersectionObserver } from '@vueuse/core'

// Prepend any photo uploaded via the Header's upload modal
const { on } = useUploadBus()
on((post) => allPosts.value.unshift(post))

// Cursor-based pagination — `null` means "fetch from the top", a timestamp means "fetch older than this"
const cursor = ref<number | null>(null)
const allPosts = ref<PostData[]>([])
const exhausted = ref(false)
const loadMoreTrigger = ref(null)

const { data, status } = await useFetch('/api/photos', {
  query: computed(() => ({
    limit: 20,
    ...(cursor.value !== null ? { before: cursor.value } : {}),
  })),
  watch: [cursor],
  lazy: true,
})

watch(data, (result) => {
  if (!result) return
  allPosts.value.push(...result.photos)
  if (result.nextCursor === null) {
    exhausted.value = true
  } else {
    cursor.value = result.nextCursor
  }
})

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