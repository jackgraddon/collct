<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <div v-if="!showMfa && !showRecovery" class="flex flex-col gap-6 p-4">
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
            @keyup.enter="onSubmit"
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
        
        <div v-if="isLogin" class="text-center">
          <UButton variant="link" color="neutral" size="sm" @click="showRecovery = true">
            Lost your passkey?
          </UButton>
        </div>
      </div>

      <!-- MFA Challenge -->
      <div v-else-if="showMfa" class="flex flex-col gap-6 p-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-semibold">Two-Factor Authentication</h1>
          <p class="text-sm text-gray-500">Enter the code from your authenticator app.</p>
        </div>
        
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
        
        <UButton variant="link" color="neutral" block @click="showMfa = false; showRecovery = true">
          Use a recovery code
        </UButton>
      </div>
      
      <!-- Recovery Flow -->
      <div v-else-if="showRecovery" class="flex flex-col gap-6 p-4">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-semibold">Account Recovery</h1>
          <p class="text-sm text-gray-500">Enter your email and one of your recovery codes.</p>
        </div>
        
        <UFormField label="Email">
          <UInput v-model="email" type="email" placeholder="Enter your email" class="w-full" />
        </UFormField>
        
        <UFormField label="Recovery Code">
          <UInput v-model="recoveryCode" placeholder="XXXX-XXXX-XXXX" class="w-full" />
        </UFormField>
        
        <UButton :loading="loading" block @click="onRedeemRecovery">Redeem Code</UButton>
        
        <UButton variant="link" color="neutral" block @click="showRecovery = false">
          Back to login
        </UButton>
      </div>
    </UPageCard>
  </div>
</template>

<script setup lang="ts">
const isLogin = ref(true)
const loading = ref(false)
const email = ref('')
const toast = useToast()
const route = useRoute()
const { fetch: refreshSession } = useUserSession()
const { register, authenticate } = useWebAuthn()
const { challenge: verifyMfa } = useTotp()
const { redeem } = useRecoveryCodes()

const redirectTo = (route.query.redirect as string) || '/feed'

const showMfa = ref(false)
const mfaToken = ref('')

const showRecovery = ref(false)
const recoveryCode = ref('')

function toggleMode() {
  isLogin.value = !isLogin.value
}

async function onSubmit() {
  if (!email.value) return
  loading.value = true
  try {
    if (isLogin.value) {
      const result = await authenticate(email.value)
      if (result && (result as any).mfaRequired) {
        showMfa.value = true
        return
      }
    } else {
      await register({ userName: email.value })
    }
    await refreshSession()
    navigateTo(redirectTo)
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

async function onVerifyMfa() {
  loading.value = true
  try {
    await verifyMfa(mfaToken.value)
    await refreshSession()
    navigateTo(redirectTo)
  } catch (error: any) {
    toast.add({
      title: 'Verification Failed',
      description: 'Invalid code. Please try again.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}

async function onRedeemRecovery() {
  loading.value = true
  try {
    await redeem(email.value, recoveryCode.value)
    await refreshSession()
    toast.add({
      title: 'Success',
      description: 'Recovery code accepted. Please register a new passkey.',
    })
    showRecovery.value = false
    isLogin.value = false // Switch to registration mode to allow re-registering passkey
  } catch (error: any) {
    toast.add({
      title: 'Recovery Failed',
      description: 'Invalid email or recovery code.',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
}
</script>
