<script setup lang="ts">
const { user } = useUserSession()
const { uri, secret, setup, verify, disable, loading: totpLoading } = useTotp()
const { codes, generate, loading: recoveryLoading } = useRecoveryCodes()
const toast = useToast()

const token = ref('')
const showTotpSetup = ref(false)
const showRecoveryCodes = ref(false)

async function onEnableTotp() {
  try {
    await setup()
    showTotpSetup.value = true
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
  }
}

async function onVerifyTotp() {
  try {
    await verify(token.value)
    toast.add({ title: 'Success', description: 'TOTP enabled successfully' })
    showTotpSetup.value = false
    token.value = ''
    // Refresh user state
    window.location.reload()
  } catch (e: any) {
    toast.add({ title: 'Error', description: 'Invalid code', color: 'error' })
  }
}

async function onDisableTotp() {
  if (!confirm('Are you sure you want to disable 2FA?')) return
  try {
    await disable()
    toast.add({ title: 'Success', description: 'TOTP disabled successfully' })
    window.location.reload()
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
  }
}

async function onGenerateRecoveryCodes() {
  try {
    await generate()
    showRecoveryCodes.value = true
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.message, color: 'error' })
  }
}

function copyCodes() {
  navigator.clipboard.writeText(codes.value.join('\n'))
  toast.add({ title: 'Copied', description: 'Recovery codes copied to clipboard' })
}
</script>

<template>
  <UContainer class="py-8">
    <UPageHeader title="Security Settings" description="Manage your account security and two-factor authentication." />
    
    <div class="space-y-8 mt-8">
      <!-- TOTP Section -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium">Two-Factor Authentication (TOTP)</h3>
            <UBadge :color="user?.totpEnabled ? 'success' : 'neutral'">
              {{ user?.totpEnabled ? 'Enabled' : 'Disabled' }}
            </UBadge>
          </div>
        </template>
        
        <div class="space-y-4">
          <p class="text-sm text-gray-500">
            Use an authenticator app (like Google Authenticator, Authy, or 1Password) to get a verification code each time you sign in.
          </p>
          
          <div v-if="!user?.totpEnabled && !showTotpSetup">
            <UButton @click="onEnableTotp" :loading="totpLoading">Enable Authenticator App</UButton>
          </div>
          
          <div v-if="showTotpSetup" class="space-y-6 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
            <div class="flex flex-col md:flex-row gap-8 items-center">
              <div v-if="uri" class="bg-white p-4 rounded-lg">
                <Qrcode :value="uri" :size="200" />
              </div>
              
              <div class="flex-1 space-y-4">
                <div>
                  <p class="font-medium">1. Scan this QR code</p>
                  <p class="text-sm text-gray-500">Open your authenticator app and scan the image.</p>
                </div>
                
                <div v-if="secret">
                  <p class="font-medium">Or enter this code manually</p>
                  <p class="font-mono text-sm bg-gray-200 dark:bg-gray-800 p-2 rounded select-all">{{ secret }}</p>
                </div>
                
                <div class="space-y-2">
                  <p class="font-medium">2. Enter verification code</p>
                  <div class="flex gap-2">
                    <UInput v-model="token" placeholder="000000" maxlength="6" class="w-32" />
                    <UButton @click="onVerifyTotp" :loading="totpLoading">Verify & Enable</UButton>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="pt-4 border-t flex justify-end">
              <UButton variant="ghost" color="neutral" @click="showTotpSetup = false">Cancel</UButton>
            </div>
          </div>
          
          <div v-if="user?.totpEnabled">
            <UButton color="error" variant="outline" @click="onDisableTotp">Disable 2FA</UButton>
          </div>
        </div>
      </UCard>
      
      <!-- Recovery Codes Section -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium">Recovery Codes</h3>
        </template>
        
        <div class="space-y-4">
          <p class="text-sm text-gray-500">
            Recovery codes can be used to access your account if you lose your passkey or authenticator device. 
            <strong>Keep them in a safe place.</strong>
          </p>
          
          <div v-if="!showRecoveryCodes">
            <UButton variant="outline" @click="onGenerateRecoveryCodes" :loading="recoveryLoading">
              {{ codes.length > 0 ? 'Regenerate' : 'Generate' }} Recovery Codes
            </UButton>
          </div>
          
          <div v-else class="space-y-4 p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
            <div class="grid grid-cols-2 gap-2 font-mono">
              <div v-for="code in codes" :key="code" class="p-2 bg-white dark:bg-gray-800 rounded text-center">
                {{ code }}
              </div>
            </div>
            
            <div class="flex justify-between items-center pt-4 border-t">
              <p class="text-xs text-error font-medium">Codes are only shown once. Save them now!</p>
              <div class="flex gap-2">
                <UButton icon="i-solar-copy-bold" variant="ghost" @click="copyCodes">Copy</UButton>
                <UButton color="neutral" @click="showRecoveryCodes = false">Done</UButton>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
