<template>
  <!-- <UPageCard class="w-full"> -->
    <UTabs :items="tabs" variant="link">
      <template #account>
        <div class="my-4">
          <div class="flex items-center gap-4">
            <div class="relative group cursor-pointer" @click="triggerAvatarUpload">
              <UAvatar
                :src="user?.avatarUrl || undefined"
                :alt="user?.name"
                size="xl"
              />
              <div class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <UIcon name="i-lucide-camera" class="text-white size-5" />
              </div>
              <input
                ref="avatarInput"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                class="hidden"
                @change="onAvatarChange"
              />
            </div>
            <div>
              <p class="font-semibold text-lg">{{ user?.name }}</p>
              <p class="text-sm text-muted">{{ user?.email }}</p>
            </div>
          </div>

            <UForm :state="accountState" class="flex flex-col gap-4" @submit="onSaveAccount">
              <UFormField label="Full Name" name="name">
                <UInput v-model="accountState.name" class="w-full" />
              </UFormField>
              <UFormField label="Email" name="email">
                <UInput v-model="accountState.email" type="email" class="w-full" />
              </UFormField>
            </UForm>

          <div>
            <div class="flex justify-end gap-2">
              <UButton variant="outline" color="neutral" @click="onResetAccount">Reset</UButton>
              <UButton @click="onSaveAccount" :loading="saving">Save changes</UButton>
              <CollctLogoutButton />
            </div>
          </div>
        </div>
      </template>

      <template #appearance>
        <div>
          <UFormField label="Color Theme">
            <UColorModeSelect />
          </UFormField>
          <p>Check out the <ULink to="/design">design page</ULink> to see your changes.</p>
        </div>
      </template>

      <template #notifications>
        <div class="my-4 space-y-4">
          <p class="text-sm text-muted">Control whether you receive push notifications when friends interact with your photos.</p>

          <div class="flex items-center gap-3 p-3 rounded-lg border border-(--ui-border)">
            <UIcon
              :name="isPushGranted ? 'i-lucide-bell-ring' : 'i-lucide-bell-off'"
              class="w-5 h-5 shrink-0"
              :class="isPushGranted ? 'text-green-500' : 'text-muted'"
            />
            <div class="flex-1">
              <p class="text-sm font-medium">
                {{ isPushGranted ? 'Notifications enabled' : isPushDenied ? 'Notifications blocked' : 'Notifications not enabled' }}
              </p>
              <p class="text-xs text-muted mt-0.5">
                {{ isPushDenied
                  ? 'You\'ll need to enable notifications in your browser settings.'
                  : isPushGranted
                    ? 'You\'ll receive push notifications for new likes, comments, and group joins.'
                    : 'Enable notifications to get alerted when friends interact with your photos.'
                }}
              </p>
            </div>
            <UButton
              v-if="!isPushGranted && !isPushDenied"
              color="primary"
              size="xs"
              @click="enableNotifications"
            >
              Enable
            </UButton>
            <UButton
              v-else-if="isPushGranted"
              color="neutral"
              variant="outline"
              size="xs"
              @click="disableNotifications"
            >
              Disable
            </UButton>
          </div>
        </div>
      </template>

      <template #security>
        <div class="my-4 space-y-6">
          <!-- TOTP Section -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium">Two-Factor Authentication</h3>
              <UBadge :color="sessionUser?.totpEnabled ? 'success' : 'neutral'" size="sm">
                {{ sessionUser?.totpEnabled ? 'Enabled' : 'Disabled' }}
              </UBadge>
            </div>
            <p class="text-sm text-muted mb-3">
              Use an authenticator app (Google Authenticator, Authy, 1Password, etc.) to get a verification code each time you sign in.
            </p>

            <!-- Enable flow -->
            <div v-if="!sessionUser?.totpEnabled && !showTotpSetup">
              <UButton @click="onEnableTotp" :loading="totpLoading" size="sm">Enable Authenticator App</UButton>
            </div>

            <!-- Setup panel -->
            <div v-if="showTotpSetup" class="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div class="flex flex-col md:flex-row gap-6 items-center">
                <div v-if="uri" class="bg-white p-3 rounded-lg">
                  <Qrcode :value="uri" :size="160" />
                </div>
                <div class="flex-1 space-y-3">
                  <div>
                    <p class="text-sm font-medium">1. Scan this QR code</p>
                    <p class="text-xs text-muted">Open your authenticator app and scan the image.</p>
                  </div>
                  <div v-if="secret">
                    <p class="text-sm font-medium">Or enter this code manually</p>
                    <p class="font-mono text-xs bg-muted p-2 rounded select-all">{{ secret }}</p>
                  </div>
                  <div class="space-y-1">
                    <p class="text-sm font-medium">2. Enter verification code</p>
                    <div class="flex gap-2">
                      <UInput v-model="token" placeholder="000000" maxlength="6" class="w-28" size="sm" />
                      <UButton @click="onVerifyTotp" :loading="totpLoading" size="sm">Verify & Enable</UButton>
                    </div>
                  </div>
                </div>
              </div>
              <div class="pt-3 border-t flex justify-end">
                <UButton variant="ghost" color="neutral" size="xs" @click="() => { showTotpSetup = false }">Cancel</UButton>
              </div>
            </div>

            <!-- Disable -->
            <div v-if="sessionUser?.totpEnabled">
              <UButton color="error" variant="outline" size="sm" @click="openDisableDialog">Disable 2FA</UButton>
            </div>
          </div>

          <USeparator />

          <!-- Recovery Codes Section -->
          <div>
            <h3 class="text-sm font-medium mb-2">Recovery Codes</h3>
            <p class="text-sm text-muted mb-3">
              Recovery codes can be used to access your account if you lose your passkey or authenticator device.
              <strong>Keep them in a safe place.</strong>
            </p>

            <div v-if="!showRecoveryCodes">
              <UButton variant="outline" size="sm" @click="onGenerateRecoveryCodes" :loading="recoveryLoading">
                {{ codes.length > 0 ? 'Regenerate' : 'Generate' }} Recovery Codes
              </UButton>
            </div>

            <div v-else class="space-y-3 p-4 border rounded-lg bg-muted/50">
              <UAlert v-if="codes.length > 0" color="warning" variant="subtle" title="Save these codes now!" description="You won't be able to see them again after you leave this page." />

              <div class="grid grid-cols-2 gap-2 font-mono">
                <div v-for="code in codes" :key="code" class="p-2 bg-muted rounded text-center text-sm">
                  {{ code }}
                </div>
              </div>

              <div class="flex justify-between items-center pt-3 border-t">
                <div class="flex gap-1">
                  <UButton icon="i-solar-copy-bold" variant="ghost" size="xs" @click="copyCodes">Copy</UButton>
                  <UButton icon="i-solar-download-bold" variant="ghost" size="xs" @click="downloadCodes">Download</UButton>
                </div>
                <UButton color="neutral" size="xs" @click="() => { showRecoveryCodes = false }">Done</UButton>
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #help>
        <div class="my-4 space-y-4">
          <p class="text-sm text-muted">Revisit the app walkthrough to refresh your memory on how Collct works.</p>
          <UButton
            @click="() => { showOobe = true }"
            color="neutral"
            variant="outline"
            icon="solar:info-circle-linear"
          >
            Replay Tour
          </UButton>
        </div>
      </template>

    </UTabs>
  <!-- </UPageCard> -->

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
        <UButton variant="outline" color="neutral" @click="() => { showDisableDialog = false }">Cancel</UButton>
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
        <UButton variant="outline" color="neutral" @click="() => { showRegenWarning = false }">Cancel</UButton>
        <UButton color="warning" @click="doGenerateRecoveryCodes">Yes, Regenerate</UButton>
      </div>
    </template>
  </UModal>

  <CollctOobeModal v-model:open="showOobe" />
</template>

<script lang="ts" setup>
definePageMeta({ title: 'Settings', description: 'Manage your settings', layout: 'page' })

const { user, refresh: refreshMe, refreshSession } = useUser()
const { user: sessionUser, fetch: refreshSessionAuth } = useUserSession()
const { isSubscribed, permission, requestPermission, subscribe, unsubscribe } = usePushNotifications()
const { uri, secret, setup, verify, disable, loading: totpLoading } = useTotp()
const { codes, generate, loading: recoveryLoading } = useRecoveryCodes()
const toast = useToast()
const saving = ref(false)
const showOobe = ref(false)

const isPushGranted = computed(() => permission.value === 'granted' && isSubscribed.value)
const isPushDenied = computed(() => permission.value === 'denied')

async function enableNotifications() {
  const granted = await requestPermission()
  if (granted) {
    toast.add({ title: 'Notifications enabled', color: 'success' })
  } else {
    toast.add({ title: 'Permission denied', description: 'You can enable notifications in your browser settings.', color: 'warning' })
  }
}

async function disableNotifications() {
  await unsubscribe()
  toast.add({ title: 'Notifications disabled', color: 'success' })
}

// TOTP
const token = ref('')
const showTotpSetup = ref(false)
const showRecoveryCodes = ref(false)
const showDisableDialog = ref(false)
const disableToken = ref('')
const disableRecoveryCode = ref('')
const disableMode = ref<'totp' | 'recovery'>('totp')
const disableLoading = ref(false)
const disableError = ref('')
const showRegenWarning = ref(false)

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
    await refreshSessionAuth()
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
    await refreshSessionAuth()
  } catch (e: any) {
    disableError.value = e.data?.message ?? 'Invalid code. Please try again.'
  } finally {
    disableLoading.value = false
  }
}

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

function downloadCodes() {
  const blob = new Blob([codes.value.join('\n')], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'collct-recovery-codes.txt'
  a.click()
}

const avatarInput = ref<HTMLInputElement | null>(null)
const uploadingAvatar = ref(false)

const accountState = reactive({
  name: user.value?.name ?? '',
  email: user.value?.email ?? '',
  avatarUrl: user.value?.avatarUrl ?? '',
})

function triggerAvatarUpload() {
  avatarInput.value?.click()
}

async function onAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploadingAvatar.value = true
  try {
    const form = new FormData()
    form.append('file', file)

    const { avatarUrl } = await $fetch<{ avatarUrl: string }>('/api/user/avatar', {
      method: 'PATCH',
      body: form,
    })

    accountState.avatarUrl = avatarUrl
    await refreshSession()
    await refreshMe()
    toast.add({ title: 'Avatar updated', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Upload failed', description: e.data?.statusMessage ?? 'Something went wrong.', color: 'error' })
  } finally {
    uploadingAvatar.value = false
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

function onResetAccount() {
  accountState.name = user.value?.name ?? ''
  accountState.email = user.value?.email ?? ''
  accountState.avatarUrl = user.value?.avatarUrl ?? ''
}

async function onSaveAccount() {
  saving.value = true
  try {
    await $fetch('/api/user/update', {
      method: 'PATCH',
      body: {
        name: accountState.name,
        email: accountState.email,
        avatarUrl: accountState.avatarUrl || null,
      },
    })
    await refreshSession()
    toast.add({ title: 'Saved', description: 'Your account has been updated.', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.statusMessage ?? 'Something went wrong.', color: 'error' })
  } finally {
    saving.value = false
  }
}

const tabs = computed(() => [
  {
    slot: 'account',
    label: 'Account',
    avatar: {
      src: user.value?.avatarUrl || undefined,
      alt: user.value?.name,
    },
  },
  {
    slot: 'notifications',
    label: 'Notifications',
    icon: 'i-lucide-bell',
  },
  {
    slot: 'security',
    label: 'Security',
    icon: 'solar:shield-check-linear',
  },
  {
    slot: 'appearance',
    label: 'Appearance',
    icon: 'i-lucide-palette',
  },
  {
    slot: 'help',
    label: 'Help',
    icon: 'i-lucide-circle-help',
  },
])
</script>