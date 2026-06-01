<template>
  <UHeader title="Collct" class="border-b-0" mode="slideover">
    <UNavigationMenu :items="items" variant="link" />
    <template #right>
      <UColorModeButton />
      <UButton label="Post" icon="solar:add-circle-linear" @click="uploadModal = true" />
    </template>
    <template #body>
      <UNavigationMenu :items="items" orientation="vertical" />
    </template>
  </UHeader>

  <CollctUploadModal v-model:open="uploadModal" @uploaded="onUploaded" />
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const { emit } = useUploadBus()

const items = computed<NavigationMenuItem[]>(() => [
  {
    label: 'Feed',
    icon: 'solar:home-smile-angle-linear',
    to: '/feed',
    active: route.path.startsWith('/feed'),
  },
  {
    label: 'Settings',
    icon: 'solar:settings-minimalistic-linear',
    to: '/settings',
    active: route.path.startsWith('/settings'),
  }
])

const uploadModal = ref(false)

function onUploaded(post: PostData) {
  uploadModal.value = false
  emit(post)
}
</script>