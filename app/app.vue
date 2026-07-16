<script lang="ts" setup>
const { user } = useUser()
const router = useRouter()

const showOobe = ref(false)

onMounted(() => {
  if (user.value && !user.value.hasSeenOobe) {
    showOobe.value = true
  }
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
    router.push('/feed')
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
          <NuxtPage />
        </NuxtLayout>
      </UContainer>
    </UMain>
  </UApp>
</template>
