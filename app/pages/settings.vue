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
        <div class="my-4 space-y-4">
          <p class="text-sm text-muted">Manage your two-factor authentication, recovery codes, and other security settings.</p>
          <UButton to="/account/security" icon="solar:shield-check-linear">
            Open Security Settings
          </UButton>
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

  <CollctOobeModal v-model:open="showOobe" />
</template>

<script lang="ts" setup>
definePageMeta({ title: 'Settings', description: 'Manage your settings', layout: 'page' })

const { user, refresh: refreshMe, refreshSession } = useUser()
const { isSubscribed, permission, requestPermission, subscribe, unsubscribe } = usePushNotifications()
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