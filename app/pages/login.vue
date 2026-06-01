<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <div class="flex flex-col gap-6 p-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-semibold">
            {{ isLogin ? 'Welcome back' : 'Create an account' }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ isLogin ? 'Sign in with your passkey.' : 'Register with a passkey — no password needed.' }}
          </p>
        </div>

        <UFormField label="Email">
          <UInput
            v-model="email"
            type="email"
            placeholder="Enter your email"
            class="w-full"
          />
        </UFormField>

        <UButton
          :loading="loading"
          block
          @click="onSubmit"
        >
          {{ isLogin ? 'Sign in' : 'Sign up' }} with Passkey
        </UButton>

        <p class="text-sm text-center text-gray-500 dark:text-gray-400">
          {{ isLogin ? "Don't have an account?" : 'Already have an account?' }}
          <UButton variant="link" color="primary" class="p-0" @click="toggleMode">
            {{ isLogin ? 'Sign up' : 'Log in' }}
          </UButton>
        </p>
      </div>
    </UPageCard>
  </div>
</template>

<script setup lang="ts">
const isLogin = ref(true)
const loading = ref(false)
const email = ref('')
const toast = useToast()
const { fetch: refreshSession } = useUserSession()
const { register, authenticate } = useWebAuthn()

function toggleMode() {
  isLogin.value = !isLogin.value
}

async function onSubmit() {
  if (!email.value) return
  loading.value = true
  try {
    if (isLogin.value) {
      await authenticate(email.value)
    } else {
      await register({ userName: email.value })
    }
    await refreshSession()
    navigateTo('/feed')
  } catch (error: any) {
    toast.add({
      title: 'Authentication Failed',
      description: error?.message || 'An error occurred. Please try again.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>