<template>
  <div>
    <CollctPostGrid :posts="allPosts" v-slot="{ post }">
      <CollctPostGridItem 
        :post-data="post as {id: string; author: string; img: string; width: number; height: number;}" 
      />
    </CollctPostGrid>

    <div ref="loadMoreTrigger" class="h-10 w-full flex items-center justify-center mt-4">
      <USkeleton v-if="status === 'pending'" class="h-8 w-32" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useIntersectionObserver } from '@vueuse/core'

// State Management
const allPosts = ref<any[]>([])
const page = ref(1)
const loadMoreTrigger = ref(null)

// We use 'page' as a reactive dependency. Whenever 'page.value' changes, this fetch runs again.
const { data, status } = await useFetch('/api/lorem/posts', {
  query: { 
    count: 20,     // How many per batch
    page: page     // Pass the current page to your real API
  },
  watch: [page],   // Auto-trigger fetch when 'page' increments
  lazy: true       // Don't block client navigation
})

// Append new data when the fetch completes
watch(data, (newPosts) => {
  if (newPosts) {
    allPosts.value.push(...newPosts)
  }
})

// Watch the invisible div at the bottom. When it comes into view, increment the page.
useIntersectionObserver(
  loadMoreTrigger,
  (entries) => {
    // Get the first entry and use optional chaining to safely access isIntersecting
    const entry = entries[0];
    const isIntersecting = entry?.isIntersecting;

    // Only increment if we are intersecting AND not currently waiting on a fetch
    if (isIntersecting && status.value !== 'pending') {
      page.value++;
    }
  },
  { threshold: 0.5 }
);
</script>