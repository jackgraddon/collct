<script lang="ts" setup>
definePageMeta({ layout: 'page' })

const toast = useToast()

const { data, refresh } = await useFetch<{ groups: GroupData[] }>('/api/groups')

const showCreateModal = ref(false)
const newName = ref('')
const newIcon = ref('')
const newColor = ref('#6366f1')
const creating = ref(false)

const iconError = computed(() => {
  const v = newIcon.value.trim()
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

async function createGroup() {
  const name = newName.value.trim()
  if (!name) return

  creating.value = true
  try {
    const body: Record<string, string> = { name }
    const icon = newIcon.value.trim()
    if (icon && !iconError.value) body.icon = icon
    if (newColor.value) body.color = newColor.value

    await $fetch('/api/groups', {
      method: 'POST',
      body,
    })
    toast.add({ title: 'Group created', color: 'success', icon: 'i-lucide-circle-check' })
    newName.value = ''
    newIcon.value = ''
    newColor.value = '#6366f1'
    showCreateModal.value = false
    await refresh()
  } catch (e: any) {
    toast.add({
      title: 'Failed to create group',
      description: e.data?.statusMessage || 'Please try again.',
      color: 'error',
      icon: 'i-lucide-triangle-alert',
    })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-10 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">Groups</h1>
        <p class="text-sm text-muted mt-1">Manage who sees your photos</p>
      </div>
      <UButton
        color="primary"
        variant="solid"
        icon="i-solar-add-circle-linear"
        @click="() => { showCreateModal = true }"
      >
        New group
      </UButton>
    </div>

    <!-- Group list -->
    <div v-if="data?.groups" class="space-y-2">
      <NuxtLink
        v-for="group in data.groups"
        :key="group.id"
        :to="group.isPublic ? undefined : `/groups/${group.id}`"
        class="flex items-center justify-between p-4 rounded-xl border border-default hover:bg-muted/30 transition-colors"
        :class="group.isPublic ? 'cursor-default' : 'cursor-pointer'"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg"
            :style="group.color ? { backgroundColor: group.color + '20', color: group.color } : undefined"
            :class="!group.color ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400' : undefined"
          >
            <span v-if="group.icon">{{ group.icon }}</span>
            <UIcon v-else :name="group.isPublic ? 'i-solar-global-linear' : 'i-solar-users-group-rounded-linear'" class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <p class="font-medium text-sm truncate">{{ group.name }}</p>
            <p class="text-xs text-muted">
              {{ group.isPublic ? 'Everyone on this server' : `Your ${group.role} group` }}
            </p>
          </div>
        </div>
        <UIcon
          v-if="!group.isPublic"
          name="i-solar-arrow-right-linear"
          class="w-4 h-4 text-muted shrink-0"
        />
      </NuxtLink>
    </div>

    <USkeleton v-else class="h-20 rounded-xl" />

    <!-- Create group modal -->
    <UModal v-model:open="showCreateModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-solar-users-group-rounded-linear" class="w-5 h-5 text-primary" />
              <span class="font-semibold">Create a group</span>
            </div>
          </template>

          <div class="space-y-4">
            <UFormField label="Group name">
              <UInput
                v-model="newName"
                placeholder="e.g. Family, Close friends"
                :maxlength="50"
                autofocus
                @keydown.enter.prevent="createGroup"
              />
            </UFormField>

            <UFormField label="Emoji icon (optional)">
              <div class="flex items-center gap-2">
                <UInput
                  v-model="newIcon"
                  placeholder="e.g. 👥, 🏠, 💼"
                  :maxlength="16"
                  class="flex-1"
                />
                <div
                  v-if="newIcon.trim() && !iconError"
                  class="w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0"
                  :style="newColor ? { backgroundColor: newColor + '20', color: newColor } : { backgroundColor: '#6B728020', color: '#6B7280' }"
                >
                  {{ newIcon.trim() }}
                </div>
              </div>
              <p v-if="iconError" class="text-xs text-error mt-1">{{ iconError }}</p>
            </UFormField>

            <UFormField label="Color (optional)">
              <div class="flex items-center gap-2">
                <input
                  v-model="newColor"
                  type="color"
                  class="w-10 h-10 rounded-lg border border-default cursor-pointer shrink-0"
                />
                <span class="text-sm text-muted">{{ newColor }}</span>
              </div>
            </UFormField>
          </div>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="() => { showCreateModal = false }">
                Cancel
              </UButton>
              <UButton
                color="primary"
                variant="solid"
                :loading="creating"
                :disabled="!newName.trim()"
                @click="createGroup"
              >
                Create
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
