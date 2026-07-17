<script setup lang="ts">
definePageMeta({ layout: 'page', title: 'Security', description: 'Manage your account security and two-factor authentication.' })

const { user, fetch: refreshSession } = useUserSession()
const { uri, secret, setup, verify, disable, loading: totpLoading } = useTotp()
const { codes, generate, loading: recoveryLoading } = useRecoveryCodes()
const toast = useToast()

const token = ref('')
const showTotpSetup = ref(false)
const showRecoveryCodes = ref(false)

// Lazy-load the QR code component (only needed when TOTP setup is active)
const LazyQrcode = defineAsyncComponent(() => import('nuxt-qrcode/dist/runtime/app/components/qrcode.vue'))

// Disable dialog state
const showDisableDialog = ref(false)
const disableToken = ref('')
const disableRecoveryCode = ref('')
const disableMode = ref<'totp' | 'recovery'>('totp')
const disableLoading = ref(false)
const disableError = ref('')

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
    toast.add({ title: 'Success', description: '2FA enabled successfully', color: 'success' })
    showTotpSetup.value = false
    token.value = ''
    await refreshSession()
  } catch (e: any) {
    toast.add({ title: 'Error', description: 'Invalid code. Please try again.', color: 'error' })
  }
}

function openDisableDialog() {
  disableToken.value = ''
  disableRecoveryCode.value = ''
  disableMode.value = 'totp'
  disableError.value = ''
  showDisableDialog.value = true
}

async function onDisableTotp() {
  disableLoading.value = true
  disableError.value = ''
  try {
    const body = disableMode.value === 'totp'
      ? { token: disableToken.value }
      : { recoveryCode: disableRecoveryCode.value }
    await disable(body)
    toast.add({ title: 'Success', description: '2FA has been disabled.', color: 'success' })
    showDisableDialog.value = false
    await refreshSession()
  } catch (e: any) {
    disableError.value = e.data?.message ?? 'Invalid code. Please try again.'
  } finally {
    disableLoading.value = false
  }
}

const showRegenWarning = ref(false)

async function onGenerateRecoveryCodes() {
  if (codes.value.length > 0) {
    showRegenWarning.value = true
    return
  }
  await doGenerateRecoveryCodes()
}

async function doGenerateRecoveryCodes() {
  showRegenWarning.value = false
  try {
    await generate()
    showRecoveryCodes.value = true
    toast.add({ title: 'Codes generated', description: 'Save these codes somewhere safe.', color: 'success' })
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
            <h3 class="text-lg font-medium">Two-Factor Authentication</h3>
            <UBadge :color="user?.totpEnabled ? 'success' : 'neutral'">
              {{ user?.totpEnabled ? 'Enabled' : 'Disabled' }}
            </UBadge>
          </div>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-muted">
            Use an authenticator app (Google Authenticator, Authy, 1Password, etc.) to get a verification code each time you sign in.
          </p>

          <!-- Enable flow -->
          <div v-if="!user?.totpEnabled && !showTotpSetup">
            <UButton @click="onEnableTotp" :loading="totpLoading">Enable Authenticator App</UButton>
          </div>

          <!-- Setup panel -->
          <div v-if="showTotpSetup" class="space-y-6 p-4 border rounded-lg bg-muted/50">
            <div class="flex flex-col md:flex-row gap-8 items-center">
              <div v-if="uri" class="bg-white p-4 rounded-lg">
                <LazyQrcode :value="uri" :size="200" />
              </div>

              <div class="flex-1 space-y-4">
                <div>
                  <p class="font-medium">1. Scan this QR code</p>
                  <p class="text-sm text-muted">Open your authenticator app and scan the image.</p>
                </div>

                <div v-if="secret">
                  <p class="font-medium">Or enter this code manually</p>
                  <p class="font-mono text-sm bg-muted p-2 rounded select-all">{{ secret }}</p>
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

          <!-- Disable -->
          <div v-if="user?.totpEnabled">
            <UButton color="error" variant="outline" @click="openDisableDialog">Disable 2FA</UButton>
          </div>
        </div>
      </UCard>

      <!-- Recovery Codes Section -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium">Recovery Codes</h3>
        </template>

        <div class="space-y-4">
          <p class="text-sm text-muted">
            Recovery codes can be used to access your account if you lose your passkey or authenticator device.
            <strong>Keep them in a safe place.</strong>
          </p>

          <div v-if="!showRecoveryCodes">
            <UButton variant="outline" @click="onGenerateRecoveryCodes" :loading="recoveryLoading">
              {{ codes.length > 0 ? 'Regenerate' : 'Generate' }} Recovery Codes
            </UButton>
          </div>

          <div v-else class="space-y-4 p-4 border rounded-lg bg-muted/50">
            <UAlert v-if="codes.length > 0" color="warning" variant="subtle" title="Save these codes now!" description="You won't be able to see them again after you leave this page." />

            <div class="grid grid-cols-2 gap-2 font-mono">
              <div v-for="code in codes" :key="code" class="p-2 bg-muted rounded text-center text-sm">
                {{ code }}
              </div>
            </div>

            <div class="flex justify-between items-center pt-4 border-t">
              <div class="flex gap-2">
                <UButton icon="i-solar-copy-bold" variant="ghost" @click="copyCodes">Copy</UButton>
                <UButton icon="i-solar-download-bold" variant="ghost" @click="() => { const blob = new Blob([codes.join('\n')], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'collct-recovery-codes.txt'; a.click() }">Download</UButton>
              </div>
              <UButton color="neutral" @click="showRecoveryCodes = false">Done</UButton>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Disable 2FA Dialog -->
    <UModal v-model:open="showDisableDialog" title="Disable Two-Factor Authentication">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-muted">
            Enter your current authenticator code or a recovery code to confirm.
          </p>

          <URadioGroup v-model="disableMode" :items="[{ label: 'Authenticator code', value: 'totp' }, { label: 'Recovery code', value: 'recovery' }]" />

          <div v-if="disableMode === 'totp'">
            <UFormField label="Verification Code">
              <UInput v-model="disableToken" placeholder="000000" maxlength="6" class="w-full" @keyup.enter="onDisableTotp" />
            </UFormField>
          </div>

          <div v-else>
            <UFormField label="Recovery Code">
              <UInput v-model="disableRecoveryCode" placeholder="XXXX-XXXX-XXXX" class="w-full" @keyup.enter="onDisableTotp" />
            </UFormField>
          </div>

          <UAlert v-if="disableError" color="error" variant="subtle" :description="disableError" />
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="outline" color="neutral" @click="showDisableDialog = false">Cancel</UButton>
          <UButton color="error" :loading="disableLoading" :disabled="disableMode === 'totp' ? !disableToken : !disableRecoveryCode" @click="onDisableTotp">
            Disable 2FA
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Regeneration Warning Dialog -->
    <UModal v-model:open="showRegenWarning" title="Regenerate Recovery Codes?">
      <template #body>
        <p class="text-sm text-muted">
          This will invalidate all your existing recovery codes. Any codes you've saved will stop working.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="outline" color="neutral" @click="showRegenWarning = false">Cancel</UButton>
          <UButton color="warning" @click="doGenerateRecoveryCodes">Yes, Regenerate</UButton>
        </div>
      </template>
    </UModal>
  </UContainer>
</template>
