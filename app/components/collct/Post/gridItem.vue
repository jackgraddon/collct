<template>
  <div class="rounded-lg border-4 border-neutral-100 max-w-[250px] overflow-hidden cursor-pointer">
    <NuxtImg 
      :src="postData.img" 
      :alt="`Photo by ${postData.author}`" 
      class="w-full object-cover hover:scale-[1.05] transition-[300ms]"
    />
  </div>
</template>

<script lang="ts" setup>
// Define the shape of the data this component expects
defineProps<{
  postData: {
    id: string
    author: string
    img: string
  }
}>()
</script>