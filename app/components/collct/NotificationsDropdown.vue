<template>
  <div ref="container" class="relative">
    <UButton
      color="neutral"
      variant="ghost"
      icon="i-lucide-bell"
      size="sm"
      class="relative"
      @click="toggle"
    >
      <span
        v-if="unreadCount > 0"
        class="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-error rounded-full"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </UButton>

    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="fixed left-4 right-4 top-14 sm:absolute sm:right-0 sm:left-auto sm:mt-2 sm:w-80 bg-(--ui-bg) rounded-lg shadow-lg border border-(--ui-border) z-50 overflow-hidden"
      >
        <div class="max-h-96 overflow-y-auto">
          <div v-if="showPrompt" class="flex items-center gap-3 p-3 bg-primary/5 border-b border-(--ui-border)">
            <div class="w-2 h-2 rounded-full shrink-0 bg-primary" />
            <UIcon name="i-lucide-bell-ring" class="w-8 h-8 text-primary shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium">Enable notifications?</p>
              <p class="text-xs text-muted mt-0.5">Get notified about likes, comments, and new posts.</p>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <UButton color="neutral" variant="ghost" size="xs" @click="dismissPrompt">Later</UButton>
              <UButton color="primary" size="xs" @click="enableNotifications">Enable</UButton>
            </div>
          </div>

          <div v-if="notifications.length" class="divide-y divide-(--ui-border)">
            <NuxtLink
              v-for="n in notifications"
              :key="n.id"
              :to="notificationLink(n)"
              class="flex items-center gap-3 p-3 transition-colors hover:bg-(--ui-bg-muted)"
              :class="{ 'bg-primary/5': !n.isRead }"
              @click="isOpen = false"
            >
              <div class="w-2 h-2 rounded-full shrink-0" :class="n.isRead ? 'bg-transparent' : 'bg-primary'" />
              <UAvatar
                :src="n.actor.avatarUrl || undefined"
                :alt="n.actor.name"
                :text="n.actor.name?.slice(0, 2).toUpperCase() || '?'"
                size="sm"
              />
              <div class="flex-1 min-w-0">
                <p class="text-sm">
                  <span class="font-medium">{{ n.actor.name }}</span>
                  <span class="text-muted">{{ notificationText(n) }}</span>
                </p>
                <p class="text-xs text-muted mt-0.5">{{ formatRelativeTime(n.createdAt) }}</p>
              </div>
              <NuxtImg
                v-if="n.photoUrl"
                :src="n.photoUrl"
                width="36"
                height="36"
                format="webp"
                class="w-9 h-9 rounded object-cover shrink-0"
              />
            </NuxtLink>
          </div>

          <div v-else class="p-8 text-center">
            <UIcon name="i-lucide-bell-off" class="w-8 h-8 text-muted mx-auto mb-2" />
            <p class="text-sm text-muted">No notifications yet</p>
          </div>
        </div>

        <NuxtLink
          to="/notifications"
          class="block text-center text-xs text-muted py-2.5 border-t border-(--ui-border) hover:bg-(--ui-bg-muted) transition-colors"
          @click="isOpen = false"
        >
          View all notifications
        </NuxtLink>
      </div>
    </Transition>
  </div>
</template>

<script lang="ts" setup>
import { onClickOutside } from '@vueuse/core'

const isOpen = ref(false)
const container = ref<HTMLElement | null>(null)
const { unreadCount, notifications } = useNotificationPolling()
const { shouldPrompt, requestPermission, dismissPrompt } = usePushNotifications()

const showPrompt = computed(() => shouldPrompt.value)

async function enableNotifications() {
  await requestPermission()
}

function toggle() {
  isOpen.value = !isOpen.value
}

onClickOutside(container, () => {
  isOpen.value = false
})

function notificationText(n: Notification): string {
  switch (n.type) {
    case 'like':
      return ' liked your photo'
    case 'comment':
      return ' commented on your photo'
    case 'group_join':
      return ' joined your group'
    case 'new_post':
      return ' posted a new photo'
    case 'moment':
      return ' — time for your daily moment!'
    default:
      return ' interacted with your content'
  }
}

function notificationLink(n: Notification): string {
  if (n.photoId) return `/post/${n.photoId}`
  if (n.groupId?.length) return `/groups/${n.groupId[0]}`
  return '/'
}

function formatRelativeTime(date: string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = Math.floor((now - then) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(date))
}
</script>
