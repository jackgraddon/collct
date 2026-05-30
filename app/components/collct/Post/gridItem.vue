<template>
  <div 
    class="relative rounded-lg border-4 border-neutral-100 max-w-[250px] overflow-hidden cursor-pointer"
    :class="activeBorder"
    :style="{ aspectRatio: `${postData.width} / ${postData.height}` }"
  >
    <USkeleton 
      v-if="!isLoaded" 
      class="absolute inset-0 w-full h-full" 
    />
    
    <NuxtImg 
      :src="postData.img" 
      :alt="`Photo by ${postData.author}`" 
      class="absolute inset-0 w-full h-full object-cover hover:scale-[1.05] transition-[300ms]"
      :class="isLoaded ? 'opacity-100' : 'opacity-0'"
      @load="isLoaded = true"
    />
    <!-- <div class="post-overlay">
      <p>{{ postData.id }}</p>
    </div> -->
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

defineProps<{
  postData: {
    id: string
    author: string
    img: string
    width: number  // Accept the new prop
    height: number // Accept the new prop
  }
}>()

// Track if the image has finished downloading
const isLoaded = ref(false)

// Access Nuxt Color Mode
const colorMode = useColorMode()

// Map themes to border classes
const themeBorders: Record<string, string> = {
  light: 'border-neutral-100',
  dark: 'border-neutral-700',
}

// Fall back to 'light' if something goes wrong
const activeBorder = computed(() => {
  return themeBorders[colorMode.value] || themeBorders.light
})
</script>

<style lang="css" scoped>
.post-overlay {
  position: absolute;
  background-color: rgba(0,0,0,0.5);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
</style>