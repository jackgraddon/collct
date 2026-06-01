<script lang="ts" setup>

const route = useRoute()
const id = Number(route.params.id)

const { data: post, status } = await useFetch<PostData>(`/api/photos/${id}`)

const toast = useToast()
const router = useRouter()

// Delete flow
const deleteModal = ref(false)
const deleting = ref(false)

async function confirmDelete() {
  deleting.value = true
  try {
    await $fetch(`/api/photos/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Photo deleted', color: 'success', icon: 'i-lucide-circle-check' })
    router.push('/')
  } catch {
    toast.add({ title: 'Failed to delete photo', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    deleting.value = false
    deleteModal.value = false
  }
}

// Share
function share() {
  navigator.clipboard.writeText(window.location.href)
  toast.add({ title: 'Link copied', color: 'neutral', icon: 'i-lucide-link' })
}

// Session — to show delete only to owner
const { user } = useUserSession()
const isOwner = computed(() => user.value?.id === post.value?.user.id)

// Format date
const formattedDate = computed(() => {
  if (!post.value?.createdAt) return ''
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(post.value.createdAt))
})
</script>

<template>
  <UContainer class="py-10 max-w-4xl">

    <!-- Loading -->
    <div v-if="status === 'pending'" class="space-y-6">
      <div class="flex items-center gap-3">
        <USkeleton class="w-10 h-10 rounded-full" />
        <div class="space-y-2">
          <USkeleton class="h-4 w-32 rounded" />
          <USkeleton class="h-3 w-24 rounded" />
        </div>
      </div>
      <USkeleton class="w-full rounded-xl" style="aspect-ratio: 4/3" />
    </div>

    <!-- Error -->
    <UAlert
      v-else-if="!post"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      title="Photo not found"
      description="This photo may have been deleted or doesn't exist."
    >
      <template #footer>
        <UButton to="/" color="error" variant="ghost" size="sm">Back to feed</UButton>
      </template>
    </UAlert>

    <!-- Post -->
    <div v-else class="space-y-6">

      <!-- Header row -->
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <UAvatar
            :src="post.user.avatarUrl ?? undefined"
            :alt="post.user.name"
            :text="post.user.name.slice(0, 2).toUpperCase()"
          />
          <div class="min-w-0">
            <ULink
              :to="`/user/${post.user.id}`"
              class="font-semibold text-sm hover:text-primary transition-colors truncate block"
            >
              {{ post.user.name }}
            </ULink>
            <p class="text-muted text-xs">{{ formattedDate }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-link"
            size="sm"
            @click="share"
          >
            Share
          </UButton>
          <UButton
            v-if="isOwner"
            color="error"
            variant="ghost"
            icon="i-solar-trash-bin-2-linear"
            size="sm"
            @click="deleteModal = true"
          >
            Delete
          </UButton>
        </div>
      </div>

      <!-- Photo -->
      <img
        :src="post.url"
        :alt="post.caption ?? `Photo by ${post.user.name}`"
        class="w-full h-auto rounded-xl"
      />

      <!-- Caption -->
      <p v-if="post.caption" class="text-base text-default">
        {{ post.caption }}
      </p>

    </div>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="deleteModal">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-solar-trash-bin-2-linear" class="text-error w-5 h-5" />
              <span class="font-semibold">Delete photo?</span>
            </div>
          </template>

          <p class="text-muted text-sm">
            This will permanently delete the photo and cannot be undone.
          </p>

          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="deleteModal = false">
                Cancel
              </UButton>
              <UButton color="error" variant="solid" :loading="deleting" @click="confirmDelete">
                Delete
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

  </UContainer>
</template>