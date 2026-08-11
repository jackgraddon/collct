<template>
  <div class="flex items-center justify-center min-h-screen p-4">
    <UPageCard class="w-full max-w-md">
      <div v-if="!user" class="flex flex-col gap-6 p-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-semibold">
            {{ isLogin ? 'Device Verification' : 'Create an Account' }}
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ isLogin ? 'Sign in with your passkey to verify your device.' : 'Register with a passkey to get started.' }}
          </p>
        </div>

        <UFormField label="Email">
          <UInput
            v-model="email"
            type="email"
            placeholder="Enter your email"
            class="w-full"
            @keyup.enter="onSubmit"
          />
        </UFormField>

        <UButton :loading="loading" block @click="onSubmit">
          {{ isLogin ? 'Sign in' : 'Sign up' }} with Passkey
        </UButton>

        <p class="text-sm text-center text-gray-500 dark:text-gray-400">
          {{ isLogin ? "Don't have an account?" : 'Already have an account?' }}
          <UButton variant="link" color="primary" class="p-0" @click="isLogin = !isLogin">
            {{ isLogin ? 'Sign up' : 'Log in' }}
          </UButton>
        </p>

        <div v-if="mfaRequired" class="flex flex-col gap-4">
          <UFormField label="Verification Code">
            <UInput
              v-model="mfaToken"
              placeholder="000000"
              maxlength="6"
              class="w-full"
              @keyup.enter="onVerifyMfa"
            />
          </UFormField>
          <UButton :loading="loading" block @click="onVerifyMfa">Verify</UButton>
        </div>
      </div>

      <div v-else-if="!codeFromUrl && !submitted" class="flex flex-col gap-6 p-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-semibold">Enter Device Code</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Enter the code shown on your device to complete verification.
          </p>
        </div>

        <UFormField label="Device Code">
          <UInput
            v-model="manualCode"
            placeholder="XXXX-XXXX"
            maxlength="9"
            class="w-full"
            @keyup.enter="onAuthorize"
          />
        </UFormField>

        <UButton :loading="loading" block @click="onAuthorize">
          Verify Device
        </UButton>
      </div>

      <div v-else-if="submitted" class="flex flex-col items-center gap-4 p-8">
        <UIcon name="i-lucide-check-circle" class="text-green-500 size-12" />
        <div class="text-center">
          <h2 class="text-lg font-semibold">Device Verified</h2>
          <p class="text-sm text-gray-500">You can close this window and return to your device.</p>
        </div>
      </div>
    </UPageCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const { register, authenticate } = useWebAuthn()
const { challenge: verifyMfa } = useTotp()
const toast = useToast()

const email = ref('')
const loading = ref(false)
const mfaRequired = ref(false)
const mfaToken = ref('')
const manualCode = ref('')
const submitted = ref(false)
const isLogin = ref(true)

const { loggedIn, user } = useUserSession()

// If code is in URL, auto-authorize after login
const codeFromUrl = computed(() => route.query.code as string | undefined)

async function onSubmit() {
  if (!email.value) return
  loading.value = true
  try {
    if (isLogin.value) {
      const result = await authenticate(email.value)
      if (result && (result as any).mfaRequired) {
        mfaRequired.value = true
        return
      }
    } else {
      await register({ userName: email.value })
    }
    await refreshSession()
    // If there's a code in the URL, auto-authorize
    if (codeFromUrl.value) {
      await doAuthorize(codeFromUrl.value)
    }
  } catch (error: any) {
    toast.add({
      title: isLogin.value ? 'Authentication Failed' : 'Registration Failed',
      description: error?.message || 'An error occurred.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

async function onVerifyMfa() {
  loading.value = true
  try {
    await verifyMfa(mfaToken.value)
    await refreshSession()
    if (codeFromUrl.value) {
      await doAuthorize(codeFromUrl.value)
    }
  } catch {
    toast.add({ title: 'Verification Failed', description: 'Invalid code.', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function onAuthorize() {
  if (!manualCode.value) return
  loading.value = true
  try {
    await doAuthorize(manualCode.value)
  } finally {
    loading.value = false
  }
}

async function doAuthorize(code: string) {
  try {
    await $fetch('/api/auth/device/authorize', {
      method: 'POST',
      body: { code: code.toUpperCase(), approve: true },
    })
    submitted.value = true
  } catch (error: any) {
    toast.add({
      title: 'Authorization Failed',
      description: error?.data?.statusMessage || 'Invalid or expired code.',
      color: 'error',
    })
  }
}
</script>
