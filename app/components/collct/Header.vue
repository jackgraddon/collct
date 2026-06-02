<template>
  <UHeader title="Collct" class="border-b-0" mode="slideover">
    <UNavigationMenu :items="items" variant="link" />
    <template #right>
      <UColorModeButton />
      <UButton label="Post" icon="solar:add-circle-linear" @click="uploadModal = true" />

      <!-- Freshly Signed User Avatar Dropdown -->
      <UDropdownMenu v-if="user" :items="userDropdownItems" :ui="{ content: 'w-48' }">
        <button class="flex items-center focus:outline-none group">
          <NuxtImg
            v-if="user.avatarUrl"
            :src="user.avatarUrl"
            width="32"
            height="32"
            class="w-8 h-8 rounded-full object-cover ring-2 ring-transparent group-hover:ring-primary-500 transition"
            :alt="user.name"
          />
          <UAvatar
            v-else
            :text="user.name?.[0].toUpperCase()"
            size="sm"
            class="ring-2 ring-transparent group-hover:ring-primary-500 transition"
          />
        </button>
      </UDropdownMenu>
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
const router = useRouter()
const { emit } = useUploadBus()
const { clear } = useUserSession()

// Reactively fetch the authenticated user profile with the signed avatar URL
const { data: user } = await useFetch('/api/user/me')

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

// Define dropdown menu actions for the logged-in user
const userDropdownItems = computed(() => [
  {
    label: user.value?.username || 'Account',
    type: 'label'
  },
  {
    label: 'Sign Out',
    icon: 'solar:logout-3-linear',
    onSelect: async () => {
      await clear()
      router.push('/login')
    }
  }
])

const uploadModal = ref(false)

function onUploaded(post: PostData) {
  uploadModal.value = false
  emit(post)
}
</script>