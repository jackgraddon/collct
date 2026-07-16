<script lang="ts" setup>
const route = useRoute()
const id = Number(route.params.id)

const { data: post, status } = await useFetch<PostData>(`/api/photos/${id}`)

const toast = useToast()
const router = useRouter()

// ─── Session ──────────────────────────────────────────────────────────────────
const { user: sessionUser } = useUserSession()
const user = sessionUser as Ref<UserSession | null>

const isOwner = computed(() => user.value?.id === post.value?.user.id)
const isLoggedIn = computed(() => !!user.value?.id)

// ─── Date ─────────────────────────────────────────────────────────────────────
const formattedDate = computed(() => {
  if (!post.value?.createdAt) return ''
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(post.value.createdAt))
})

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

// ─── Types ────────────────────────────────────────────────────────────────────
// All types are imported from shared/types/posts.ts above

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'thumbs_up',   emoji: '👍', label: 'Like' },
  { type: 'thumbs_down', emoji: '👎', label: 'Dislike' },
  { type: 'heart',       emoji: '❤️', label: 'Love' },
  { type: 'cry',         emoji: '😢', label: 'Sad' },
]

// ─── Likes ────────────────────────────────────────────────────────────────────
// Use local refs rather than useFetch so optimistic updates are instant.
// Poll every 10s to pick up other users' likes.

const liked = ref(false)
const likeCount = ref<number | null>(null)
const liking = ref(false)

async function fetchLikes() {
  const data = await $fetch<{ liked: boolean; count: number | null }>(`/api/photos/${id}/likes`)
  // Only update count from server (not liked) while the user is mid-interaction
  if (!liking.value) liked.value = data.liked
  likeCount.value = data.count
}

async function toggleLike() {
  if (!isLoggedIn.value || liking.value) return
  liking.value = true

  // Optimistic update
  liked.value = !liked.value
  if (likeCount.value !== null) {
    likeCount.value += liked.value ? 1 : -1
  }

  try {
    const result = await $fetch<{ liked: boolean; count: number | null }>(
      `/api/photos/${id}/likes`,
      { method: 'POST' },
    )
    // Settle with server truth
    liked.value = result.liked
    likeCount.value = result.count
  } catch {
    // Revert optimistic update
    liked.value = !liked.value
    if (likeCount.value !== null) {
      likeCount.value += liked.value ? 1 : -1
    }
    toast.add({ title: 'Could not update like', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    liking.value = false
  }
}

// ─── Comments ─────────────────────────────────────────────────────────────────
const commentList = ref<CommentItem[]>([])
const newComment = ref('')
const submittingComment = ref(false)

async function fetchComments() {
  const fresh = await $fetch<CommentItem[]>(`/api/photos/${id}/comments`)

  // Merge: update existing comments in place (preserves reaction state for
  // the current user mid-interaction), and append any new ones from the server.
  const existingIds = new Set(commentList.value.map((c) => c.id))
  const freshIds = new Set(fresh.map((c) => c.id))

  // Remove comments that were deleted server-side
  commentList.value = commentList.value.filter((c) => freshIds.has(c.id))

  for (const freshComment of fresh) {
    const idx = commentList.value.findIndex((c) => c.id === freshComment.id)
    if (idx !== -1) {
      // Update reactions from server but preserve body/user (they don't change)
      const updated: CommentItem = {
        id: commentList.value[idx].id,
        body: commentList.value[idx].body,
        createdAt: commentList.value[idx].createdAt,
        user: commentList.value[idx].user,
        reactions: freshComment.reactions,
      }
      commentList.value[idx] = updated
    } else if (!existingIds.has(freshComment.id)) {
      // New comment from another user — append
      commentList.value.push(freshComment)
    }
  }
}

async function submitComment() {
  const body = newComment.value.trim()
  if (!body || !isLoggedIn.value) return
  submittingComment.value = true
  try {
    const created = await $fetch<CommentItem>(`/api/photos/${id}/comments`, {
      method: 'POST',
      body: { body },
    })
    commentList.value.push(created)
    newComment.value = ''
  } catch {
    toast.add({ title: 'Could not post comment', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    submittingComment.value = false
  }
}

// ─── Comment reactions ────────────────────────────────────────────────────────
const openReactionPicker = ref<number | null>(null)
const reactingOn = ref<number | null>(null)

function toggleReactionPicker(commentId: number) {
  openReactionPicker.value = openReactionPicker.value === commentId ? null : commentId
}

function closeReactionPicker() {
  openReactionPicker.value = null
}

async function react(comment: CommentItem, type: ReactionType) {
  if (!isLoggedIn.value) return
  reactingOn.value = comment.id

  // Optimistic update
  const prev = { ...comment.reactions }
  const idx = commentList.value.findIndex((c) => c.id === comment.id)
  if (idx !== -1) {
    const counts: ReactionCounts = { ...comment.reactions.counts }
    if (comment.reactions.myReaction) {
      counts[comment.reactions.myReaction] = Math.max(0, counts[comment.reactions.myReaction] - 1)
    }
    const isToggleOff = comment.reactions.myReaction === type
    if (!isToggleOff) {
      counts[type] = (counts[type] ?? 0) + 1
    }
    // Spread-merge all fields to avoid type issues
    const updated: CommentItem = {
      id: commentList.value[idx].id,
      body: commentList.value[idx].body,
      createdAt: commentList.value[idx].createdAt,
      user: commentList.value[idx].user,
      reactions: {
        counts,
        myReaction: isToggleOff ? null : type,
      },
    }
    commentList.value[idx] = updated
  }

  try {
    const result = await $fetch<{ counts: ReactionCounts; myReaction: ReactionType | null }>(
      `/api/comments/${comment.id}/reactions`,
      { method: 'POST', body: { type } },
    )
    // Settle with server truth
    if (idx !== -1) {
      const settled: CommentItem = {
        id: commentList.value[idx].id,
        body: commentList.value[idx].body,
        createdAt: commentList.value[idx].createdAt,
        user: commentList.value[idx].user,
        reactions: result,
      }
      commentList.value[idx] = settled
    }
  } catch {
    // Revert
    if (idx !== -1) {
      const reverted: CommentItem = {
        id: commentList.value[idx].id,
        body: commentList.value[idx].body,
        createdAt: commentList.value[idx].createdAt,
        user: commentList.value[idx].user,
        reactions: prev,
      }
      commentList.value[idx] = reverted
    }
    toast.add({ title: 'Could not add reaction', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    reactingOn.value = null
    openReactionPicker.value = null
  }
}

// ─── Polling ──────────────────────────────────────────────────────────────────
// WebSockets are not supported on Vercel serverless. Poll every 10s instead.
// The merge strategies above ensure polls don't clobber local optimistic state.

const POLL_INTERVAL = 10_000

let likesTimer: ReturnType<typeof setInterval> | null = null
let commentsTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  // Initial fetch
  await Promise.all([fetchLikes(), fetchComments()])

  likesTimer = setInterval(fetchLikes, POLL_INTERVAL)
  commentsTimer = setInterval(fetchComments, POLL_INTERVAL)
})

onUnmounted(() => {
  if (likesTimer) clearInterval(likesTimer)
  if (commentsTimer) clearInterval(commentsTimer)
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(dateStr))
}

function totalReactions(counts: ReactionCounts) {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}
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

      <!-- Photo -->
      <NuxtImg
        :src="post.url"
        :alt="post.caption || `Photo by ${post.user.name}`"
        sizes="sm:100vw md:800px"
        format="webp"
        class="w-full h-auto rounded-xl"
      />

      <!-- Group chips -->
      <CollctPostGroupChips :groups="post.groups" />

      <!-- Caption + Like row -->
      <div class="flex items-start justify-between gap-4">
        <p v-if="post.caption" class="text-base text-default flex-1">
          {{ post.caption }}
        </p>
        <div v-else class="flex-1" />

        <!-- Like button -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Like count — only shown to the post owner -->
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

      <!-- ─── Comments section ─────────────────────────────────────────────── -->
      <div class="border-t border-default pt-6 space-y-5">

        <h2 class="text-sm font-semibold text-muted uppercase tracking-wider">
          {{ commentList.length === 0 ? 'No comments yet' : `${commentList.length} comment${commentList.length === 1 ? '' : 's'}` }}
        </h2>

        <!-- Comment list -->
        <div class="space-y-4">
          <div
            v-for="comment in commentList"
            :key="comment.id"
            class="flex gap-3"
          >
            <UAvatar
              :src="comment.user.avatarUrl || undefined"
              :alt="comment.user.name"
              :text="comment.user.name.slice(0, 2).toUpperCase()"
              size="sm"
              class="shrink-0 mt-0.5"
            />

            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-2 flex-wrap">
                <ULink
                  :to="`/user/${comment.user.id}`"
                  class="font-semibold text-sm hover:text-primary transition-colors"
                >
                  {{ comment.user.name }}
                </ULink>
                <span class="text-muted text-xs">{{ formatRelative(comment.createdAt) }}</span>
              </div>

              <p class="text-sm text-default mt-0.5 break-words">{{ comment.body }}</p>

              <!-- Reaction bar -->
              <div class="flex items-center gap-1 mt-1.5 flex-wrap relative">

                <template v-if="totalReactions(comment.reactions.counts) > 0">
                  <button
                    v-for="r in REACTIONS.filter(r => comment.reactions.counts[r.type] > 0)"
                    :key="r.type"
                    class="inline-flex items-center gap-0.5 text-xs rounded-full px-2 py-0.5 transition-colors"
                    :class="comment.reactions.myReaction === r.type
                      ? 'bg-primary/15 text-primary font-medium'
                      : 'bg-muted/30 text-muted hover:bg-muted/50'"
                    :title="r.label"
                    :disabled="!isLoggedIn || reactingOn === comment.id"
                    @click="react(comment, r.type)"
                  >
                    {{ r.emoji }}
                    <span>{{ comment.reactions.counts[r.type] }}</span>
                  </button>
                </template>

                <div v-if="isLoggedIn" class="relative">
                  <button
                    class="inline-flex items-center gap-1 text-xs text-muted hover:text-default rounded-full px-2 py-0.5 hover:bg-muted/30 transition-colors"
                    :title="openReactionPicker === comment.id ? 'Close' : 'Add reaction'"
                    @click.stop="toggleReactionPicker(comment.id)"
                  >
                    <UIcon name="i-lucide-smile-plus" class="w-3.5 h-3.5" />
                  </button>

                  <Transition
                    enter-active-class="transition ease-out duration-100"
                    enter-from-class="opacity-0 scale-95"
                    enter-to-class="opacity-100 scale-100"
                    leave-active-class="transition ease-in duration-75"
                    leave-from-class="opacity-100 scale-100"
                    leave-to-class="opacity-0 scale-95"
                  >
                    <div
                      v-if="openReactionPicker === comment.id"
                      v-click-outside="closeReactionPicker"
                      class="absolute bottom-full left-0 mb-1 z-10 flex items-center gap-0.5 bg-default border border-default rounded-xl shadow-lg px-2 py-1.5"
                    >
                      <button
                        v-for="r in REACTIONS"
                        :key="r.type"
                        class="text-lg hover:scale-125 transition-transform px-1 rounded"
                        :class="comment.reactions.myReaction === r.type ? 'bg-primary/15' : ''"
                        :title="r.label"
                        :disabled="reactingOn === comment.id"
                        @click="react(comment, r.type)"
                      >
                        {{ r.emoji }}
                      </button>
                    </div>
                  </Transition>
                </div>

              </div>
            </div>
          </div>
        </div>

        <!-- New comment input -->
        <div v-if="isLoggedIn" class="flex gap-3 pt-2">
          <UAvatar
            :src="user?.avatarUrl || undefined"
            :alt="user?.name ?? ''"
            :text="(user?.name ?? '?').slice(0, 2).toUpperCase()"
            size="sm"
            class="shrink-0 mt-0.5"
          />
          <div class="flex-1 flex gap-2">
            <UInput
              v-model="newComment"
              placeholder="Add a comment…"
              class="flex-1"
              :maxlength="1000"
              @keydown.enter.exact.prevent="submitComment"
            />
            <UButton
              color="primary"
              variant="solid"
              size="sm"
              :loading="submittingComment"
              :disabled="!newComment.trim()"
              @click="submitComment"
            >
              Post
            </UButton>
          </div>
        </div>

        <p v-else class="text-sm text-muted">
          <ULink to="/login" class="text-primary hover:underline">Sign in</ULink> to leave a comment.
        </p>

      </div>
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