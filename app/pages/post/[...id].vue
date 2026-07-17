<script lang="ts" setup>
const route = useRoute()
const id = Number(route.params.id)

// Instant — read preloaded data passed via route state from the grid
const preloaded = ref<PostData | null>((history.state as any).preloadedPost ?? null)
const thumbnailUrl = ref<string>((history.state as any).thumbnailUrl ?? preloaded.value?.url ?? null)

// Background — fetch fresh/full data (comments, likes, edit history)
const { data: freshPost, status } = useFetch<PostData>(`/api/photos/${id}`, { lazy: true })

// Prefer fresh data once it arrives, fall back to preloaded for instant render
const post = computed(() => freshPost.value ?? preloaded.value)

const toast = useToast()
const router = useRouter()

// ─── Session ──────────────────────────────────────────────────────────────────
const { user, sessionUser } = useUser()

const isOwner = computed(() => sessionUser.value?.id === post.value?.user.id)
const isLoggedIn = computed(() => !!sessionUser.value?.id)

// ─── Date ─────────────────────────────────────────────────────────────────────
const formattedDate = computed(() => {
  if (!post.value?.createdAt) return ''
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(post.value.createdAt))
})

function formatEditDate(isoString: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoString))
}

// ─── Delete ───────────────────────────────────────────────────────────────────
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

// ─── Share ────────────────────────────────────────────────────────────────────
function share() {
  navigator.clipboard.writeText(window.location.href)
  toast.add({ title: 'Link copied', color: 'neutral', icon: 'i-lucide-link' })
}

// ─── Likes ────────────────────────────────────────────────────────────────────
const liked = ref(false)
const likeCount = ref<number | null>(null)
const liking = ref(false)

async function fetchLikes() {
  const data = await $fetch<{ liked: boolean; count: number | null }>(`/api/photos/${id}/likes`)
  if (!liking.value) liked.value = data.liked
  likeCount.value = data.count
}

async function toggleLike() {
  if (!isLoggedIn.value || liking.value) return
  liking.value = true

  liked.value = !liked.value
  if (likeCount.value !== null) {
    likeCount.value += liked.value ? 1 : -1
  }

  try {
    const result = await $fetch<{ liked: boolean; count: number | null }>(
      `/api/photos/${id}/likes`,
      { method: 'POST' },
    )
    liked.value = result.liked
    likeCount.value = result.count
  } catch {
    liked.value = !liked.value
    if (likeCount.value !== null) {
      likeCount.value += liked.value ? 1 : -1
    }
    toast.add({ title: 'Could not update like', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    liking.value = false
  }
}

// ─── Caption editing ──────────────────────────────────────────────────────────
const editingCaption = ref(false)
const editedCaption = ref('')
const savingCaption = ref(false)
const captionHistoryModal = ref(false)

function startEditCaption() {
  editedCaption.value = post.value?.caption ?? ''
  editingCaption.value = true
}

function cancelEditCaption() {
  editingCaption.value = false
  editedCaption.value = ''
}

async function saveCaption() {
  if (!post.value) return
  savingCaption.value = true
  try {
    const updated = await $fetch<PostData>(`/api/photos/${id}`, {
      method: 'PATCH',
      body: { caption: editedCaption.value || null },
    })
    post.value = { ...post.value, ...updated }
    editingCaption.value = false
    toast.add({ title: 'Caption updated', color: 'success', icon: 'i-lucide-circle-check' })
  } catch {
    toast.add({ title: 'Could not update caption', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    savingCaption.value = false
  }
}

// ─── Likes polling ────────────────────────────────────────────────────────────
const POLL_INTERVAL = 10_000
let likesTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  if (likesTimer) return
  likesTimer = setInterval(fetchLikes, POLL_INTERVAL)
}

function stopPolling() {
  if (likesTimer) clearInterval(likesTimer)
  likesTimer = null
}

onMounted(async () => {
  await fetchLikes()
  startPolling()

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling()
    } else {
      fetchLikes()
      startPolling()
    }
  })
})

onUnmounted(() => {
  stopPolling()
})
</script>

<template>
  <UContainer class="py-10 max-w-4xl">

    <!-- Loading (only when no preloaded data) -->
    <div v-if="!post && status === 'pending'" class="space-y-6">
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
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            size="sm"
            @click="router.back()"
          />
          <UAvatar
            :src="post.user.avatarUrl || undefined"
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

      <!-- Photo — constrained to remaining viewport so header + photo never overflow -->
      <NuxtImg
        v-if="post"
        :src="freshPost ? post.url : (thumbnailUrl || post.url)"
        :alt="post.caption || `Photo by ${post.user.name}`"
        sizes="sm:100vw md:800px"
        format="webp"
        class="max-h-[calc(100dvh-12rem)] w-auto max-w-full object-contain rounded-xl mx-auto block"
        :style="{ viewTransitionName: `photo-${post.id}` }"
      />
      <USkeleton v-else class="w-full rounded-xl" style="aspect-ratio: 4/3" />

      <!-- Group chips -->
      <CollctPostGroupChips :groups="post.groups" />

      <!-- Caption + Like row -->
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0 space-y-1">
          <!-- Caption display -->
          <template v-if="!editingCaption">
            <p v-if="post.caption" class="text-base text-default whitespace-pre-wrap">{{ post.caption }}</p>
            <p v-else class="text-sm text-muted italic">No caption</p>

            <!-- Edited indicator -->
            <button
              v-if="post.captionEditedAt"
              class="text-xs text-muted hover:text-default transition-colors"
              @click="captionHistoryModal = true"
            >
              (edited)
            </button>

            <!-- Edit button (owner only) -->
            <button
              v-if="isOwner"
              class="text-xs text-primary hover:text-primary/80 transition-colors"
              @click="startEditCaption"
            >
              Edit caption
            </button>
          </template>

          <!-- Caption edit mode -->
          <template v-else>
            <UTextarea
              v-model="editedCaption"
              placeholder="Write a caption…"
              :rows="3"
              :maxlength="500"
              class="w-full"
            />
            <div class="flex items-center gap-2">
              <UButton
                size="xs"
                :loading="savingCaption"
                @click="saveCaption"
              >
                Save
              </UButton>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="savingCaption"
                @click="cancelEditCaption"
              >
                Cancel
              </UButton>
            </div>
          </template>
        </div>

        <!-- Like button -->
        <div class="flex items-center gap-2 shrink-0">
          <span
            v-if="isOwner && likeCount !== null"
            class="text-sm text-muted tabular-nums"
          >
            {{ likeCount }} {{ likeCount === 1 ? 'like' : 'likes' }}
          </span>

          <UButton
            :color="liked ? 'error' : 'neutral'"
            :variant="liked ? 'soft' : 'ghost'"
            size="sm"
            :loading="liking"
            :disabled="!isLoggedIn"
            :title="isLoggedIn ? (liked ? 'Unlike' : 'Like') : 'Sign in to like'"
            @click="toggleLike"
          >
            <template #leading>
              <UIcon
                name="i-lucide-heart"
                :class="liked ? 'fill-current text-error' : 'text-muted'"
                class="w-4 h-4"
              />
            </template>
          </UButton>
        </div>
      </div>

      <!-- Comments (lazy-loaded sub-component) -->
      <CollctPostComments
        :photo-id="id"
        :is-logged-in="isLoggedIn"
        :session-user-id="sessionUser?.id ?? null"
        :user="user"
      />
    </div>

    <!-- Delete confirmation modal -->
    <UModal v-if="deleteModal" v-model:open="deleteModal">
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

    <!-- Caption history modal -->
    <UModal v-if="captionHistoryModal" v-model:open="captionHistoryModal">
      <template #content>
        <UCard>
          <template #header>
            <span class="font-semibold">Caption History</span>
          </template>

          <div v-if="post?.captionHistory?.length" class="space-y-3 max-h-64 overflow-y-auto">
            <div
              v-for="(version, idx) in post.captionHistory"
              :key="idx"
              class="border-l-2 border-default pl-3 py-2"
            >
              <p class="text-xs text-muted">
                {{ formatEditDate(version.editedAt) }}
                <span v-if="idx === post.captionHistory!.length - 1" class="ml-2 text-primary">
                  (current)
                </span>
              </p>
              <p class="text-sm text-default whitespace-pre-wrap mt-1">
                {{ version.text ?? '(no caption)' }}
              </p>
            </div>
          </div>

          <template #footer>
            <div class="flex justify-end">
              <UButton color="neutral" variant="ghost" @click="captionHistoryModal = false">
                Close
              </UButton>
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

  </UContainer>
</template>
