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
import { useBreakpoints, breakpointsTailwind } from '@vueuse/core'

const props = defineProps<{
  posts: PostData[]
}>()

const breakpoints = useBreakpoints(breakpointsTailwind)
const sm = breakpoints.greaterOrEqual('sm')
const md = breakpoints.greaterOrEqual('md')
const lg = breakpoints.greaterOrEqual('lg')

const columnCount = computed(() => {
  if (lg.value) return 6
  if (md.value) return 5
  if (sm.value) return 4
  return 3
})

const distributedColumns = computed(() => {
  const columns: PostData[][] = Array.from({ length: columnCount.value }, () => [])
  props.posts.forEach((post, index) => {
    columns[index % columnCount.value]?.push(post)
  })
  return columns
})
</script>