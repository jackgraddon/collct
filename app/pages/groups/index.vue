<script lang="ts" setup>
definePageMeta({ layout: 'page' })

const toast = useToast()

const { data, refresh } = await useFetch<{ groups: GroupData[] }>('/api/groups')

const showCreateModal = ref(false)
const newName = ref('')
const creating = ref(false)

async function createGroup() {
  const name = newName.value.trim()
  if (!name) return

  creating.value = true
  try {
    await $fetch('/api/groups', {
      method: 'POST',
      body: { name },
    })
    toast.add({ title: 'Group created', color: 'success', icon: 'i-lucide-circle-check' })
    newName.value = ''
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
        @click="showCreateModal = true"
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
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <UIcon
              :name="group.isPublic ? 'i-solar-globe-linear' : 'i-solar-users-group-rounded-linear'"
              class="w-5 h-5 text-primary"
            />
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

          <UFormField label="Group name">
            <UInput
              v-model="newName"
              placeholder="e.g. Family, Close friends"
              :maxlength="50"
              autofocus
              @keydown.enter.prevent="createGroup"
            />
          </UFormField>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="showCreateModal = false">
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
