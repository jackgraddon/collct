<template>
  <div class="flex gap-[5px] items-start w-full">
    <div 
      v-for="(column, colIndex) in distributedColumns" 
      :key="colIndex" 
      class="flex-1 flex flex-col gap-[5px]"
    >
      <slot 
        v-for="post in column" 
        :key="post.id" 
        :post="post" 
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useBreakpoints, breakpointsTailwind } from '@vueuse/core'

const props = defineProps<{
  posts: any[]
}>()

// Track responsive breakpoints matching Tailwind
const breakpoints = useBreakpoints(breakpointsTailwind)
const sm = breakpoints.greaterOrEqual('sm')
const md = breakpoints.greaterOrEqual('md')
const lg = breakpoints.greaterOrEqual('lg')

// Reactively determine the column count (matching your previous CSS classes)
const columnCount = computed(() => {
  if (lg.value) return 6
  if (md.value) return 5
  if (sm.value) return 4
  return 3 // Default mobile
})

// Distribute the posts left-to-right into the columns
const distributedColumns = computed(() => {
  // Create an array of empty arrays based on the current column count
  const columns: any[][] = Array.from({ length: columnCount.value }, () => [])
  
  // Deal the posts into the columns sequentially
  props.posts.forEach((post, index) => {
    const targetColumn = index % columnCount.value
    columns[targetColumn]?.push(post)
  })
  
  return columns
})
</script>