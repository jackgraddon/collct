<script lang="ts" setup>
const props = defineProps<{
  photoId: number
  isLoggedIn: boolean
  sessionUserId: number | null
  user: { avatarUrl: string | null; name: string | null } | null
}>()

const toast = useToast()

// ─── Types ────────────────────────────────────────────────────────────────────
const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'thumbs_up',   emoji: '👍', label: 'Like' },
  { type: 'thumbs_down', emoji: '👎', label: 'Dislike' },
  { type: 'heart',       emoji: '❤️', label: 'Love' },
  { type: 'cry',         emoji: '😢', label: 'Sad' },
]

// ─── Comments ─────────────────────────────────────────────────────────────────
const commentList = ref<CommentItem[]>([])
const newComment = ref('')
const submittingComment = ref(false)

async function fetchComments() {
  const fresh = await $fetch<CommentItem[]>(`/api/photos/${props.photoId}/comments`)

  const freshById = new Map(fresh.map((c) => [c.id, c]))
  const freshIds = new Set(freshById.keys())

  // Remove deleted comments, update existing in place
  commentList.value = commentList.value
    .filter((c) => freshIds.has(c.id))
    .map((c) => {
      const fc = freshById.get(c.id)
      if (!fc) return c
      return {
        id: c.id,
        body: c.body,
        editedAt: fc.editedAt,
        editHistory: fc.editHistory,
        createdAt: c.createdAt,
        user: c.user,
        reactions: fc.reactions,
      }
    })

  // Append new comments
  for (const fc of fresh) {
    if (!commentList.value.some((c) => c.id === fc.id)) {
      commentList.value.push(fc)
    }
  }
}

async function submitComment() {
  const body = newComment.value.trim()
  if (!body || !props.isLoggedIn) return
  submittingComment.value = true
  try {
    const created = await $fetch<CommentItem>(`/api/photos/${props.photoId}/comments`, {
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

// ─── Comment editing ──────────────────────────────────────────────────────────
const editingCommentId = ref<number | null>(null)
const editedCommentBody = ref('')
const savingCommentId = ref<number | null>(null)
const commentHistoryOpen = ref(false)
const commentHistoryItem = ref<CommentItem | null>(null)

function startEditComment(comment: CommentItem) {
  editingCommentId.value = comment.id
  editedCommentBody.value = comment.body
}

function cancelEditComment() {
  editingCommentId.value = null
  editedCommentBody.value = ''
}

async function saveComment(commentId: number) {
  savingCommentId.value = commentId
  try {
    const updated = await $fetch<CommentItem>(`/api/comments/${commentId}`, {
      method: 'PATCH',
      body: { body: editedCommentBody.value },
    })
    const idx = commentList.value.findIndex((c) => c.id === commentId)
    if (idx !== -1) {
      const existing = commentList.value[idx]!
      commentList.value[idx] = {
        ...existing,
        body: updated.body,
        editedAt: updated.editedAt,
        editHistory: updated.editHistory,
      }
    }
    editingCommentId.value = null
    toast.add({ title: 'Comment updated', color: 'success', icon: 'i-lucide-circle-check' })
  } catch {
    toast.add({ title: 'Could not update comment', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    savingCommentId.value = null
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
  if (!props.isLoggedIn) return
  reactingOn.value = comment.id

  const prev = { ...comment.reactions }
  const idx = commentList.value.findIndex((c) => c.id === comment.id)
  if (idx !== -1) {
    const cur = commentList.value[idx]!
    const counts: ReactionCounts = { ...comment.reactions.counts }
    if (comment.reactions.myReaction) {
      counts[comment.reactions.myReaction] = Math.max(0, counts[comment.reactions.myReaction] - 1)
    }
    const isToggleOff = comment.reactions.myReaction === type
    if (!isToggleOff) {
      counts[type] = (counts[type] ?? 0) + 1
    }
    const updated: CommentItem = {
      id: cur.id,
      body: cur.body,
      editedAt: cur.editedAt,
      editHistory: cur.editHistory,
      createdAt: cur.createdAt,
      user: cur.user,
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
    if (idx !== -1) {
      const cur = commentList.value[idx]!
      const settled: CommentItem = {
        id: cur.id,
        body: cur.body,
        editedAt: cur.editedAt,
        editHistory: cur.editHistory,
        createdAt: cur.createdAt,
        user: cur.user,
        reactions: result,
      }
      commentList.value[idx] = settled
    }
  } catch {
    if (idx !== -1) {
      const cur = commentList.value[idx]!
      const reverted: CommentItem = {
        id: cur.id,
        body: cur.body,
        editedAt: cur.editedAt,
        editHistory: cur.editHistory,
        createdAt: cur.createdAt,
        user: cur.user,
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
const POLL_INTERVAL = 10_000
let commentsTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  if (commentsTimer) return
  commentsTimer = setInterval(fetchComments, POLL_INTERVAL)
}

function stopPolling() {
  if (commentsTimer) clearInterval(commentsTimer)
  commentsTimer = null
}

onMounted(async () => {
  await fetchComments()
  startPolling()

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling()
    } else {
      fetchComments()
      startPolling()
    }
  })
})

onUnmounted(() => {
  stopPolling()
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

function formatEditDate(isoString: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoString))
}

function totalReactions(counts: ReactionCounts) {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}
</script>

<template>
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
              :to="`/user/${comment.user.username}`"
              class="font-semibold text-sm hover:text-primary transition-colors"
            >
              {{ comment.user.name }}
            </ULink>
            <span class="text-muted text-xs">{{ formatRelative(comment.createdAt) }}</span>

            <button
              v-if="comment.editedAt"
              class="text-xs text-muted hover:text-default transition-colors"
              @click="() => { commentHistoryItem = comment; commentHistoryOpen = true }"
            >
              (edited)
            </button>
          </div>

          <!-- Comment body display -->
          <template v-if="editingCommentId !== comment.id">
            <p class="text-sm text-default mt-0.5 break-words">{{ comment.body }}</p>

            <button
              v-if="sessionUserId === comment.user.id"
              class="text-xs text-primary hover:text-primary/80 transition-colors mt-0.5"
              @click="startEditComment(comment)"
            >
              Edit
            </button>
          </template>

          <!-- Comment edit mode -->
          <template v-else>
            <UTextarea
              v-model="editedCommentBody"
              :rows="2"
              :maxlength="1000"
              class="w-full mt-0.5"
            />
            <div class="flex items-center gap-2 mt-1">
              <UButton
                size="xs"
                :loading="savingCommentId === comment.id"
                @click="saveComment(comment.id)"
              >
                Save
              </UButton>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="savingCommentId === comment.id"
                @click="cancelEditComment"
              >
                Cancel
              </UButton>
            </div>
          </template>

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

  <!-- Comment history modal -->
  <UModal v-if="commentHistoryOpen" v-model:open="commentHistoryOpen">
    <template #content>
      <UCard>
        <template #header>
          <span class="font-semibold">Comment History</span>
        </template>

        <div v-if="commentHistoryItem?.editHistory?.length" class="space-y-3 max-h-64 overflow-y-auto">
          <div
              v-for="(version, idx) in commentHistoryItem!.editHistory"
            :key="idx"
            class="border-l-2 border-default pl-3 py-2"
          >
            <p class="text-xs text-muted">
              {{ formatEditDate(version.editedAt) }}
                <span v-if="idx === commentHistoryItem!.editHistory!.length - 1" class="ml-2 text-primary">
                (current)
              </span>
            </p>
            <p class="text-sm text-default whitespace-pre-wrap mt-1">
              {{ version.text }}
            </p>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton color="neutral" variant="ghost" @click="() => { commentHistoryOpen = false }">
              Close
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
