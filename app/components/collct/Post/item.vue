<template>
  <div class="flex flex-col gap-2 p-4">
    <img 
      :src="postData.img" 
      :alt="`Post by ${postData.author}`" 
      class="w-full h-full"
      :width="postData.imgWidth" :height="postData.imgWidth"
    />
    <p>{{ postData.author }}</p>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  postData : { id: string; author: string; img: string, imgWidth?: number, imgHeight? :number }; 
}>()
</script>

<style scoped>
</style>