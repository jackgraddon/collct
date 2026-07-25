<template>
  <div class="flex items-center justify-center min-h-screen p-4">
    <UPageCard class="w-full max-w-md">
      <!-- Not logged in -->
      <div v-if="!loggedIn && !approved" class="flex flex-col gap-6 p-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-semibold">Sign In to Authorize</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Sign in with your passkey to authorize <strong>{{ appName }}</strong>.
          </p>
        </div>

        <UFormField label="Email">
          <UInput
            v-model="email"
            type="email"
            placeholder="Enter your email"
            class="w-full"
            @keyup.enter="onLogin"
          />
        </UFormField>

        <UButton :loading="loading" block @click="onLogin">
          Sign in with Passkey
        </UButton>

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

      <!-- Logged in, show consent -->
      <div v-else-if="loggedIn && !approved && authCode" class="flex flex-col gap-6 p-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-semibold">Authorize App</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            <strong>{{ appName }}</strong> is requesting access to your Collct account.
          </p>
        </div>

        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p class="text-sm font-medium mb-2">This app will be able to:</p>
          <ul class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li class="flex items-center gap-2">
              <UIcon name="i-lucide-check" class="text-green-500 size-4" />
              View your photos and groups
            </li>
            <li class="flex items-center gap-2">
              <UIcon name="i-lucide-check" class="text-green-500 size-4" />
              Upload photos
            </li>
            <li class="flex items-center gap-2">
              <UIcon name="i-lucide-check" class="text-green-500 size-4" />
              Comment and react
            </li>
          </ul>
        </div>

        <UButton :loading="loading" block @click="onApprove">
          Authorize
        </UButton>

        <UButton variant="outline" color="neutral" block @click="onDeny">
          Deny
        </UButton>
      </div>

      <!-- Approved -->
      <div v-else-if="approved" class="flex flex-col items-center gap-4 p-8">
        <UIcon name="i-lucide-check-circle" class="text-green-500 size-12" />
        <div class="text-center">
          <h2 class="text-lg font-semibold">Authorized</h2>
          <p class="text-sm text-gray-500">You can close this window and return to your app.</p>
        </div>
      </div>
    </UPageCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const { authenticate } = useWebAuthn()
const { challenge: verifyMfa } = useTotp()
const toast = useToast()

const email = ref('')
const loading = ref(false)
const mfaRequired = ref(false)
const mfaToken = ref('')
const approved = ref(false)

const { loggedIn } = useUserSession()

const authCode = computed(() => route.query.code as string | undefined)

// Fetch app name from the pending authorization
const appName = ref('Unknown App')
if (authCode.value) {
  try {
    const data = await $fetch('/api/auth/authorize/info', {
      params: { code: authCode.value },
    })
    appName.value = (data as any).app_name || 'Unknown App'
  } catch {
    // Code might be invalid, that's fine
  }
}

async function onLogin() {
  if (!email.value) return
  loading.value = true
  try {
    const result = await authenticate(email.value)
    if (result && (result as any).mfaRequired) {
      mfaRequired.value = true
      return
    }
    await refreshSession()
  } catch (error: any) {
    toast.add({
      title: 'Authentication Failed',
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
  } catch {
    toast.add({ title: 'Verification Failed', description: 'Invalid code.', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function onApprove() {
  if (!authCode.value) return
  loading.value = true
  try {
    const { redirect_url } = await $fetch('/api/auth/authorize/approve', {
      method: 'POST',
      body: { code: authCode.value },
    })
    if (redirect_url) {
      window.location.href = redirect_url
    } else {
      approved.value = true
    }
  } catch (error: any) {
    toast.add({
      title: 'Authorization Failed',
      description: error?.data?.statusMessage || 'Could not authorize.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

async function onDeny() {
  if (!authCode.value) return
  try {
    await $fetch('/api/auth/authorize/deny', {
      method: 'POST',
      body: { code: authCode.value },
    })
  } catch {
    // ignore
  }
  toast.add({ title: 'Denied', description: 'Authorization was denied.' })
}
</script>
