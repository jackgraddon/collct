<script lang="ts" setup>
useHead({
  link: [
    // Portrait
    { rel: 'apple-touch-startup-image', href: '/splash/splash-750x1334.png', media: '(device-width: 375px) and (device-height: 667px) and (orientation: portrait)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-1179x2556.png', media: '(device-width: 430px) and (device-height: 932px) and (orientation: portrait)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-1290x2796.png', media: '(device-width: 440px) and (device-height: 956px) and (orientation: portrait)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-1536x2048.png', media: '(device-width: 768px) and (device-height: 1024px) and (orientation: portrait)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-1640x2360.png', media: '(device-width: 820px) and (device-height: 1180px) and (orientation: portrait)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-1668x2388.png', media: '(device-width: 834px) and (device-height: 1194px) and (orientation: portrait)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-2048x2732.png', media: '(device-width: 1024px) and (device-height: 1366px) and (orientation: portrait)' },
    // Landscape
    { rel: 'apple-touch-startup-image', href: '/splash/splash-1334x750.png', media: '(device-width: 375px) and (device-height: 667px) and (orientation: landscape)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-2556x1179.png', media: '(device-width: 430px) and (device-height: 932px) and (orientation: landscape)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-2796x1290.png', media: '(device-width: 440px) and (device-height: 956px) and (orientation: landscape)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-2048x1536.png', media: '(device-width: 768px) and (device-height: 1024px) and (orientation: landscape)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-2360x1640.png', media: '(device-width: 820px) and (device-height: 1180px) and (orientation: landscape)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-2388x1668.png', media: '(device-width: 834px) and (device-height: 1194px) and (orientation: landscape)' },
    { rel: 'apple-touch-startup-image', href: '/splash/splash-2732x2048.png', media: '(device-width: 1024px) and (device-height: 1366px) and (orientation: landscape)' },
  ],
})

const { user } = useUser()
const router = useRouter()
const { subscribe } = usePushNotifications()

const showOobe = ref(false)

onMounted(() => {
  if (user.value && !user.value.hasSeenOobe) {
    showOobe.value = true
  }
  subscribe()
})

// Watch for user data loading after mount
watch(
  () => user.value,
  (u) => {
    if (u && !u.hasSeenOobe && !showOobe.value) {
      showOobe.value = true
    }
  },
)

function handleOobeCta(action: string) {
  if (action === 'create-group') {
    router.push('/groups')
  } else if (action === 'view-feed') {
    router.push('/')
  }
}
</script>

<template>
  <UApp>
    <CollctOobeModal
      v-model:open="showOobe"
      @cta="handleOobeCta"
    />
    <UMain>
      <UContainer>
        <NuxtLayout>
          <KeepAlive :max="3">
            <NuxtPage />
          </KeepAlive>
        </NuxtLayout>
      </UContainer>
    </UMain>
  </UApp>
</template>
