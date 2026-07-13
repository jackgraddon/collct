<template>
  <!-- <UPageCard class="w-full"> -->
    <UTabs :items="tabs" variant="link">
      <template #account>
        <div class="my-4">
          <div class="flex items-center gap-4">
            <div class="relative group cursor-pointer" @click="triggerAvatarUpload">
              <UAvatar
                :src="`/api/avatar/${user.avatarUrl}` ?? undefined"
                :alt="user.name"
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
              <p class="font-semibold text-lg">{{ user.name }}</p>
              <p class="text-sm text-muted">{{ user.email }}</p>
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

      <template #security>
        <div class="my-4 space-y-4">
          <p class="text-sm text-muted">Manage your two-factor authentication, recovery codes, and other security settings.</p>
          <UButton to="/account/security" icon="solar:shield-check-linear">
            Open Security Settings
          </UButton>
        </div>
      </template>

    </UTabs>
  <!-- </UPageCard> -->
</template>

<script lang="ts" setup>
definePageMeta({ title: 'Settings', description: 'Manage your settings', layout: 'page' })

const { user: sessionUser, fetch: refreshSession } = useUserSession()
const toast = useToast()
const saving = ref(false)

const avatarInput = ref<HTMLInputElement | null>(null)
const uploadingAvatar = ref(false)

const user = computed(() => sessionUser.value ?? { name: '', email: '', avatarUrl: null })

const accountState = reactive({
  name: user.value.name,
  email: user.value.email,
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
    toast.add({ title: 'Avatar updated', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Upload failed', description: e.data?.statusMessage ?? 'Something went wrong.', color: 'error' })
  } finally {
    uploadingAvatar.value = false
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

function onResetAccount() {
  accountState.name = user.value.name
  accountState.email = user.value.email
  accountState.avatarUrl = user.value.avatarUrl ?? ''
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
      src: user.value.avatarUrl ?? undefined,
      alt: user.value.name,
    },
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
])
</script>