<template>
  <UButton
    color="neutral"
    variant="ghost"
    icon="i-lucide-bell"
    size="sm"
    to="/notifications"
    class="relative"
  >
    <span
      v-if="unreadCount > 0"
      class="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-error rounded-full"
    >
      {{ unreadCount > 99 ? '99+' : unreadCount }}
    </span>
  </UButton>
</template>

<script lang="ts" setup>
const { data } = await useFetch<{ count: number }>('/api/notifications/unread-count', {
  key: 'notifications-unread',
})

const unreadCount = computed(() => data.value?.count ?? 0)
</script>
