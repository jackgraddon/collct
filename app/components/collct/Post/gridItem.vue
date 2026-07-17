<template>
  <div
    class="relative rounded-lg border-4 overflow-hidden cursor-pointer"
    :class="activeBorder"
  >
    <ULink :to="`/post/${postData.id}`">
      <USkeleton
        v-if="!isLoaded"
        class="absolute inset-0 w-full h-full min-h-[120px]"
      />

      <NuxtImg
        :src="postData.url"
        :alt="postData.caption ?? `Photo by ${postData.user.name}`"
        width="400"
        format="webp"
        class="w-full h-auto block hover:scale-[1.05] transition-[300ms]"
        :class="isLoaded ? 'opacity-100' : 'opacity-0'"
        :style="{ viewTransitionName: `photo-${postData.id}` }"
        @load="isLoaded = true"
      />

      <!-- Avatar badge (top-left) -->
      <div class="absolute top-2 left-2 z-10">
        <UAvatar
          :src="postData.user?.avatarUrl ?? undefined"
          :alt="postData.user?.name"
          :text="postData.user?.name?.slice(0, 2).toUpperCase() || '?'"
          size="md"
          class="ring-2 ring-white dark:ring-gray-900"
        />
      </div>

      <!-- Group chips overlay -->
      <CollctPostGroupChips
        :groups="postData.groups"
        class="absolute bottom-2 left-2 right-2"
      />
    </ULink>
  </div>
</template>

<script lang="ts" setup>

defineProps<{
  postData: PostData
}>()

const isLoaded = ref(false)
const colorMode = useColorMode()

const themeBorders: Record<string, string> = {
  light: 'border-neutral-100',
  dark: 'border-neutral-700',
}

const activeBorder = computed(() => {
  return themeBorders[colorMode.value] || themeBorders.light
})
</script>
