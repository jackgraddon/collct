<script lang="ts" setup>
definePageMeta({ layout: 'page' })

const route = useRoute()
const router = useRouter()
const toast = useToast()

const groupId = Number(route.params.id)
const { user: sessionUser } = useUserSession()
const currentUserId = computed(() => (sessionUser.value as any)?.id)

const { data: group, status, refresh } = await useFetch<GroupData>(`/api/groups/${groupId}`)

const isOwner = computed(() => group.value?.ownerId === currentUserId.value)
const isAdmin = computed(() => isOwner.value || group.value?.role === 'admin')
const isMember = computed(() => !!group.value?.role)

// Group customization
const editIcon = ref('')
const editColor = ref('#6366f1')
const savingCustomization = ref(false)

watch(group, (g) => {
  if (g) {
    editIcon.value = g.icon || ''
    editColor.value = g.color || '#6366f1'
  }
}, { immediate: true })

const editIconError = computed(() => {
  const v = editIcon.value.trim()
  if (!v) return ''
  if (v.length > 16) return 'Emoji is too long'
  for (const char of v) {
    const cp = char.codePointAt(0)!
    const isExtendedPictographic = cp >= 0x1F000 && cp <= 0x1FFFF
    const isVariationSelector = cp === 0xFE0F || cp === 0xFE0E
    const isZWJ = cp === 0x200D
    const isSkinTone = cp >= 0x1F3FB && cp <= 0x1F3FF
    const isRegionalIndicator = cp >= 0x1F1E6 && cp <= 0x1F1FF
    if (!isExtendedPictographic && !isVariationSelector && !isZWJ && !isSkinTone && !isRegionalIndicator) {
      return 'Please provide a single emoji character'
    }
  }
  if (!/[\p{Extended_Pictographic}]/u.test(v)) return 'Please provide a single emoji character'
  return ''
})

async function saveCustomization() {
  if (editIconError.value) return
  savingCustomization.value = true
  try {
    const updated = await $fetch<GroupData>(`/api/groups/${groupId}`, {
      method: 'PATCH',
      body: {
        icon: editIcon.value.trim() || '',
        color: editColor.value,
      },
    })
    if (group.value) {
      group.value.icon = updated.icon
      group.value.color = updated.color
    }
    toast.add({ title: 'Group updated', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (e: any) {
    toast.add({
      title: 'Failed to update group',
      description: e.data?.statusMessage || 'Please try again.',
      color: 'error',
      icon: 'i-lucide-triangle-alert',
    })
  } finally {
    savingCustomization.value = false
  }
}

// Leave group
const leaving = ref(false)
async function leaveGroup() {
  leaving.value = true
  try {
    await $fetch(`/api/groups/${groupId}/leave`, { method: 'POST' })
    toast.add({ title: 'Left group', color: 'success', icon: 'i-lucide-circle-check' })
    router.push('/groups')
  } catch (e: any) {
    toast.add({
      title: 'Failed to leave group',
      description: e.data?.statusMessage || 'Please try again.',
      color: 'error',
      icon: 'i-lucide-triangle-alert',
    })
  } finally {
    leaving.value = false
  }
}

// Invite management
const showInviteModal = ref(false)
const inviteMaxUses = ref<number | null>(null)
const inviteExpiresHours = ref<number | null>(null)
const creatingInvite = ref(false)
const activeInvites = ref<GroupInvite[]>([])
const loadingInvites = ref(false)

async function loadInvites() {
  loadingInvites.value = true
  try {
    const data = await $fetch<{ invites: GroupInvite[] }>(`/api/groups/${groupId}/invites`)
    activeInvites.value = data.invites
  } catch {
    // Silently fail — non-critical
  } finally {
    loadingInvites.value = false
  }
}

async function createInvite() {
  creatingInvite.value = true
  try {
    await $fetch(`/api/groups/${groupId}/invites`, {
      method: 'POST',
      body: {
        maxUses: inviteMaxUses.value,
        expiresInHours: inviteExpiresHours.value,
      },
    })
    toast.add({ title: 'Invite created', color: 'success', icon: 'i-lucide-circle-check' })
    inviteMaxUses.value = null
    inviteExpiresHours.value = null
    showInviteModal.value = false
    await loadInvites()
  } catch (e: any) {
    toast.add({
      title: 'Failed to create invite',
      description: e.data?.statusMessage || 'Please try again.',
      color: 'error',
      icon: 'i-lucide-triangle-alert',
    })
  } finally {
    creatingInvite.value = false
  }
}

async function revokeInvite(inviteId: string) {
  try {
    await $fetch(`/api/groups/${groupId}/invites/${inviteId}`, { method: 'DELETE' })
    toast.add({ title: 'Invite revoked', color: 'success', icon: 'i-lucide-circle-check' })
    await loadInvites()
  } catch {
    toast.add({ title: 'Failed to revoke invite', color: 'error', icon: 'i-lucide-triangle-alert' })
  }
}

function copyInviteLink(code: string) {
  const url = `${window.location.origin}/join/${code}`
  navigator.clipboard.writeText(url)
  toast.add({ title: 'Invite link copied', color: 'neutral', icon: 'i-lucide-link' })
}

// Load invites if admin
watchEffect(() => {
  if (isAdmin.value) loadInvites()
})
</script>

<template>
  <div class="max-w-2xl mx-auto py-10 space-y-8">
    <!-- Loading -->
    <div v-if="status === 'pending'" class="space-y-4">
      <USkeleton class="h-8 w-48 rounded" />
      <USkeleton class="h-20 rounded-xl" />
    </div>

    <!-- Not found -->
    <UAlert
      v-else-if="!group"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      title="Group not found"
      description="This group may have been deleted or you're not a member."
    >
      <template #footer>
        <UButton to="/groups" color="error" variant="ghost" size="sm">Back to groups</UButton>
      </template>
    </UAlert>

    <!-- Group detail -->
    <template v-else>
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
            :style="group.color ? { backgroundColor: group.color + '20', color: group.color } : undefined"
            :class="!group.color ? 'bg-primary/10 text-primary' : undefined"
          >
            <span v-if="group.icon">{{ group.icon }}</span>
            <UIcon v-else name="i-solar-users-group-rounded-linear" class="w-6 h-6" />
          </div>
          <div>
            <h1 class="text-xl font-semibold">{{ group.name }}</h1>
            <p class="text-sm text-muted capitalize">{{ group.role }}</p>
          </div>
        </div>
        <UButton
          v-if="!group.isPublic"
          color="error"
          variant="ghost"
          size="sm"
          :loading="leaving"
          @click="leaveGroup"
        >
          Leave group
        </UButton>
      </div>

      <!-- Customization (admin+ only) -->
      <div v-if="isAdmin && !group.isPublic" class="space-y-3">
        <h2 class="text-sm font-semibold text-muted uppercase tracking-wider">Appearance</h2>
        <div class="p-4 rounded-xl border border-default space-y-4">
          <div class="flex items-center gap-4">
            <div
              class="w-14 h-14 rounded-full flex items-center justify-center text-3xl shrink-0"
              :style="editColor ? { backgroundColor: editColor + '20', color: editColor } : undefined"
              :class="!editColor ? 'bg-primary/10 text-primary' : undefined"
            >
              <span v-if="editIcon.trim() && !editIconError">{{ editIcon.trim() }}</span>
              <UIcon v-else name="i-solar-users-group-rounded-linear" class="w-7 h-7" />
            </div>
            <div class="flex-1 space-y-2">
              <UInput
                v-model="editIcon"
                placeholder="Add an emoji (e.g., 👥, 🏠, 💼)"
                :maxlength="16"
              />
              <p v-if="editIconError" class="text-xs text-error">{{ editIconError }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <input
                v-model="editColor"
                type="color"
                class="w-10 h-10 rounded-lg border border-default cursor-pointer"
              />
            </div>
          </div>
          <div class="flex justify-end">
            <UButton
              color="primary"
              variant="solid"
              size="sm"
              :loading="savingCustomization"
              :disabled="!!editIconError"
              @click="saveCustomization"
            >
              Save
            </UButton>
          </div>
        </div>
      </div>

      <!-- Members -->
      <div class="space-y-3">
        <h2 class="text-sm font-semibold text-muted uppercase tracking-wider">
          Members ({{ group.members?.length ?? 0 }})
        </h2>
        <div class="space-y-1">
          <div
            v-for="member in group.members"
            :key="member.id"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <NuxtLink :to="`/user/${member.userId}`" class="flex items-center gap-3 min-w-0 flex-1">
              <UAvatar
                :src="member.avatarUrl || undefined"
                :alt="member.name"
                :text="member.name.slice(0, 2).toUpperCase()"
                size="sm"
              />
              <div class="min-w-0">
                <p class="text-sm font-medium truncate">{{ member.name }}</p>
                <p class="text-xs text-muted">@{{ member.username }}</p>
              </div>
            </NuxtLink>
            <span
              v-if="member.role !== 'member'"
              class="text-[10px] font-medium uppercase tracking-wider text-muted bg-muted/30 px-2 py-0.5 rounded-full"
            >
              {{ member.role }}
            </span>
          </div>
        </div>
      </div>

      <!-- Invites (admin+ only) -->
      <div v-if="isAdmin" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-muted uppercase tracking-wider">Invites</h2>
          <UButton
            color="primary"
            variant="soft"
            size="xs"
            icon="i-solar-add-circle-linear"
            @click="showInviteModal = true"
          >
            New invite
          </UButton>
        </div>

        <div v-if="activeInvites.length === 0" class="text-sm text-muted py-4 text-center">
          No active invites
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="invite in activeInvites"
            :key="invite.id"
            class="flex items-center justify-between p-3 rounded-lg border border-default"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm font-mono truncate">{{ invite.code }}</p>
              <p class="text-xs text-muted">
                {{ invite.useCount }} uses
                <template v-if="invite.maxUses"> / {{ invite.maxUses }} max</template>
                <template v-if="invite.expiresAt"> · expires {{ new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(invite.expiresAt)) }}</template>
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-link"
                title="Copy invite link"
                @click="copyInviteLink(invite.code)"
              />
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-x"
                title="Revoke invite"
                @click="revokeInvite(invite.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Create invite modal -->
    <UModal v-model:open="showInviteModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-link" class="w-5 h-5 text-primary" />
              <span class="font-semibold">Create invite</span>
            </div>
          </template>

          <div class="space-y-4">
            <UFormField label="Max uses (optional)">
              <UInput
                v-model.number="inviteMaxUses"
                type="number"
                placeholder="Unlimited"
                :min="1"
              />
            </UFormField>
            <UFormField label="Expires in hours (optional)">
              <UInput
                v-model.number="inviteExpiresHours"
                type="number"
                placeholder="Never"
                :min="1"
                :max="720"
              />
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="showInviteModal = false">
                Cancel
              </UButton>
              <UButton
                color="primary"
                variant="solid"
                :loading="creatingInvite"
                @click="createInvite"
              >
                Create invite
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
