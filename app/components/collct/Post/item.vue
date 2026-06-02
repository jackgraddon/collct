<template>
  <div class="flex flex-col gap-2 p-4">
    <NuxtImg 
      :src="postData.url" 
      :alt="`Post by ${postData.user.name}`" 
      class="w-full h-auto"
    />
    <p>{{ postData.user.name }}</p>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  postData: PostData
}>()
</script>