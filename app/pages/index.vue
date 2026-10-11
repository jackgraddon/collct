<template>
  <div>
    <!-- Pull to refresh indicator -->
    <div
      class="flex justify-center overflow-hidden transition-all duration-200"
      :style="{ height: pullDistance ? `${pullDistance}px` : ptrRefreshing ? '40px' : '0px' }"
    >
      <div class="flex items-center justify-center py-2">
        <UIcon
          name="i-lucide-refresh-cw"
          :class="{ 'animate-spin': ptrRefreshing }"
          class="w-5 h-5 text-muted transition-opacity"
          :style="{ opacity: Math.min((pullDistance || (ptrRefreshing ? 40 : 0)) / 40, 1) }"
        />
      </div>
    </div>
    <!-- New posts banner -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <button
        v-if="newPostCount > 0"
        class="w-full mb-4 py-2 px-4 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
        @click="showNewPosts"
      >
        {{ newPostCount }} new {{ newPostCount === 1 ? 'post' : 'posts' }} — tap to see
      </button>
    </Transition>

    <!-- Pending moment upload indicator -->
    <CollctMomentPendingIndicator
      :visible="capture.isPending.value || capture.hasDraft.value"
      :is-error="capture.flowState.value === 'error'"
      :error-message="capture.lastUploadError.value"
      :retry-count="capture.retryCount.value"
      @retry="capture.retryUpload()"
    />

    <CollctPostGrid :posts="visiblePosts" v-slot="{ post }">
      <CollctPostGridItem :post-data="post" />
    </CollctPostGrid>

    <div ref="loadMoreTrigger" class="h-10 w-full flex items-center justify-center mt-4">
      <USkeleton v-if="loadingMore" class="h-8 w-32" />
      <p v-else-if="exhausted" class="text-sm text-neutral-400">You're all caught up!</p>
    </div>

    <!-- Upload modal (non-moment) -->
    <CollctPostModal
      v-model:open="showUploadModal"
      mode="upload"
      @uploaded="onUpload"
    />

    <!-- Moment capture overlay -->
    <CollctMomentCaptureOverlay
      :visible="showCaptureOverlay"
      :time-remaining="captureTimeRemaining"
      :allow-library-fallback="allowLibraryFallback"
      @capture="onCapture"
      @dismiss="onCaptureDismiss"
    />

    <!-- Moment group selection modal -->
    <CollctPostModal
      v-model:open="showGroupSelect"
      mode="moment"
      :preview-url="capture.capturedPreviewUrl.value"
      :groups="momentsGroups"
      :uploading="capture.flowState.value === 'uploading'"
      @retake="onGroupSelectBack"
      @submit="onGroupSubmit"
    />
  </div>
</template>

<script lang="ts" setup>
import { useIntersectionObserver } from '@vueuse/core'

const { on } = useUploadBus()
const route = useRoute()
const router = useRouter()
const toast = useToast()

// Upload modal state (non-moment)
const showUploadModal = ref(false)

// Moment capture flow
const capture = useMomentCapture()
const { momentState, isActive, capturedToday, timeRemaining: captureTimeRemaining, momentsGroups, refresh: refreshMoment } = useMoment()

const uploadedThisSession = ref(false)

const showCaptureOverlay = computed(() => {
  const state = capture.flowState.value
  return !uploadedThisSession.value && ((state === 'idle' && isActive.value && !capturedToday.value) || state === 'capturing')
})

const showGroupSelect = computed({
  get() {
    const state = capture.flowState.value
    return state === 'captured' || state === 'selecting-groups' || state === 'uploading'
  },
  set(val) {
    if (!val) {
      capture.dismissMissedAndReset()
    }
  },
})

const allowLibraryFallback = computed(() => momentState.value?.allowLibraryFallback ?? false)

// Auto-open capture overlay from notification or ?moment=capture
watch(() => route.query.moment, (val) => {
  if (val === 'capture') {
    capture.startCapture()
    router.replace({ query: {} })
  }
}, { immediate: true })

function onCapture(blob: Blob, previewUrl: string) {
  capture.onShutterTap(blob, previewUrl)
  capture.enterGroupSelection(momentsGroups.value)
}

function onCaptureDismiss() {
  if (capture.flowState.value === 'capturing') {
    capture.dismissMissedAndReset()
    const missKey = `moment_miss_shown_${new Date().toISOString().slice(0, 10)}`
    if (!localStorage.getItem(missKey)) {
      localStorage.setItem(missKey, '1')
      toast.add({
        title: 'Moment missed',
        description: 'You missed today\'s moment, but you can still post a normal photo.',
        color: 'warning',
        icon: 'i-lucide-clock',
      })
    }
    markUnreadMomentNotificationsAsRead()
  } else {
    capture.resetFlow()
  }
}

async function markUnreadMomentNotificationsAsRead() {
  try {
    const data = await $fetch<{ notifications: Array<{ id: number; type: string; isRead: boolean }> }>('/api/notifications', { query: { limit: 50 } })
    const unreadMomentIds = data.notifications
      .filter(n => n.type === 'moment' && !n.isRead)
      .map(n => n.id)
    if (unreadMomentIds.length > 0) {
      await $fetch('/api/notifications/read', {
        method: 'PATCH',
        body: { ids: unreadMomentIds },
      })
    }
  } catch {
    // Best effort — don't block UX
  }
}

function onGroupSelectBack() {
  capture.startCapture()
}

async function onGroupSubmit(groupIds: number[]) {
  capture.setGroupIds(groupIds)
  const success = await capture.submitUpload()
  if (success) {
    uploadedThisSession.value = true
    toast.add({ title: 'Moment captured!', color: 'success', icon: 'i-lucide-circle-check' })
    refreshMoment()
    markUnreadMomentNotificationsAsRead()
  }
}

// ─── Feed state (shared via composable) ──────────────────────────────────────
const feed = useFeed({ limit: 20, pollInterval: 10_000 })
const { photos, exhausted } = feed

// New posts that arrived since last visible state
const pendingNewPosts = ref<PostData[]>([])
const newPostCount = computed(() => pendingNewPosts.value.length)
const loadMoreTrigger = ref(null)
const loadingMore = ref(false)

// ─── Pull to refresh ────────────────────────────────────────────────────────
const { pullDistance, refreshing: ptrRefreshing } = usePullToRefresh(async () => {
  pendingNewPosts.value = []
  await feed.fetchPage()
})

// Visible posts = pending new + feed
const visiblePosts = computed(() => [
  ...pendingNewPosts.value,
  ...photos.value,
])

// ─── Check for new posts on every mount ──────────────────────────────────────
onMounted(async () => {
  await feed.checkNew()
})

function showNewPosts() {
  if (pendingNewPosts.value.length) {
    feed.photos = [...pendingNewPosts.value, ...feed.photos]
    pendingNewPosts.value = []
  }
}

// ─── Load more (infinite scroll) ─────────────────────────────────────────────
async function loadMore() {
  if (loadingMore.value || exhausted.value) return
  loadingMore.value = true
  await feed.fetchMore()
  loadingMore.value = false
}

// ─── Handle uploads ──────────────────────────────────────────────────────────
on((post) => feed.addPost(post))

function onUpload(post: PostData) {
  feed.addPost(post)
}

// ─── Intersection observer for infinite scroll ───────────────────────────────
useIntersectionObserver(
  loadMoreTrigger,
  (entries) => {
    const isIntersecting = entries[0]?.isIntersecting
    if (isIntersecting && !loadingMore.value && !exhausted.value) {
      loadMore()
    }
  },
  { threshold: 0.5 },
)
</script>
