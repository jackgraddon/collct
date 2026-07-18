<script lang="ts" setup>
definePageMeta({ layout: 'default' })

const route = useRoute()
const username = computed(() => route.params.username as string)

const { data: profile, status: profileStatus } = await useFetch<{
  user: { id: number; username: string; name: string; avatarUrl: string | null; createdAt: string }
  stats: { photoCount: number; commentCount: number; joinedDate: string }
  groupsInCommon: { id: number; name: string; slug: string; icon: string | null; color: string | null }[]
}>(`/api/users/${username.value}`)

const { data: photosData, status: photosStatus } = await useFetch<{
  photos: PostData[]
  nextCursor: number | null
}>(`/api/users/${username.value}/photos`, { query: { limit: 20 } })

const loadingMore = ref(false)
const photos = computed(() => photosData.value?.photos ?? [])
const nextCursor = computed(() => photosData.value?.nextCursor ?? null)
const hasMore = computed(() => nextCursor.value !== null)

async function loadMore() {
  if (loadingMore.value || !nextCursor.value) return
  loadingMore.value = true
  try {
    const result = await $fetch<{
      photos: PostData[]
      nextCursor: number | null
    }>(`/api/users/${username.value}/photos`, {
      query: { limit: 20, before: nextCursor.value },
    })
    if (photosData.value) {
      photosData.value = {
        photos: [...photosData.value.photos, ...result.photos],
        nextCursor: result.nextCursor,
      }
    }
  } finally {
    loadingMore.value = false
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

function lighten(hex: string | null | undefined, amount = 0.85): string {
  const c = hex || '#6B7280'
  const r = parseInt(c.slice(1, 3), 16)
  const g = parseInt(c.slice(3, 5), 16)
  const b = parseInt(c.slice(5, 7), 16)
  const lr = Math.round(r + (255 - r) * amount)
  const lg = Math.round(g + (255 - g) * amount)
  const lb = Math.round(b + (255 - b) * amount)
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}
</script>

<template>
  <UContainer class="py-10 max-w-4xl">

    <!-- Loading -->
    <div v-if="profileStatus === 'pending'" class="space-y-6">
      <div class="flex items-center gap-4">
        <USkeleton class="w-20 h-20 rounded-full" />
        <div class="space-y-2">
          <USkeleton class="h-6 w-40 rounded" />
          <USkeleton class="h-4 w-28 rounded" />
        </div>
      </div>
      <USkeleton class="h-4 w-64 rounded" />
      <div class="grid grid-cols-3 gap-4 sm:gap-6">
        <USkeleton v-for="i in 6" :key="i" class="aspect-square rounded-lg" />
      </div>
    </div>

    <!-- Error -->
    <UAlert
      v-else-if="!profile"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      title="User not found"
      description="This user may not exist or their profile is unavailable."
    >
      <template #footer>
        <UButton to="/" color="error" variant="ghost" size="sm">Back to feed</UButton>
      </template>
    </UAlert>

    <!-- Profile -->
    <template v-else>

      <!-- Header -->
      <div class="flex items-start gap-4">
        <UAvatar
          :src="profile.user.avatarUrl || undefined"
          :alt="profile.user.name"
          :text="profile.user.name.slice(0, 2).toUpperCase()"
          size="xl"
          class="shrink-0"
        />

        <div class="flex-1 min-w-0">
          <h1 class="text-2xl font-bold text-default">{{ profile.user.name }}</h1>
          <p class="text-muted text-sm">@{{ profile.user.username }}</p>

          <div class="flex gap-6 mt-3 text-sm">
            <div>
              <span class="font-semibold text-default">{{ profile.stats.photoCount }}</span>
              <span class="text-muted">{{ profile.stats.photoCount === 1 ? ' photo' : ' photos' }}</span>
            </div>
            <div>
              <span class="font-semibold text-default">{{ profile.stats.commentCount }}</span>
              <span class="text-muted">{{ profile.stats.commentCount === 1 ? ' comment' : ' comments' }}</span>
            </div>
          </div>

          <p class="text-sm text-muted mt-2">
            Joined {{ formatDate(profile.stats.joinedDate) }}
          </p>
        </div>
      </div>

      <!-- Groups in common -->
      <div v-if="profile.groupsInCommon.length > 0" class="mt-6">
        <h2 class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          Groups in common
        </h2>
        <div class="flex flex-wrap gap-1.5">
          <NuxtLink
            v-for="group in profile.groupsInCommon"
            :key="group.id"
            :to="`/groups/${group.id}`"
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80"
            :style="{
              backgroundColor: lighten(group.color),
              color: group.color || '#6B7280',
            }"
          >
            <span v-if="group.icon">{{ group.icon }}</span>
            <span>{{ group.name }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Photos -->
      <div class="mt-8">
        <h2 class="text-lg font-bold text-default mb-4">Photos</h2>

        <template v-if="photosStatus === 'pending'">
          <div class="grid grid-cols-3 gap-[5px]">
            <USkeleton v-for="i in 6" :key="i" class="aspect-square rounded-lg" />
          </div>
        </template>

        <template v-else-if="photos.length > 0">
          <CollctPostGrid :posts="photos" v-slot="{ post }">
            <CollctPostGridItem :post-data="post" />
          </CollctPostGrid>
        </template>

        <div v-else class="text-center py-12">
          <UIcon name="i-lucide-image" class="w-10 h-10 text-muted mx-auto mb-2" />
          <p class="text-muted text-sm">No photos yet</p>
        </div>

        <!-- Load more -->
        <div v-if="hasMore" class="mt-6 text-center">
          <UButton
            color="primary"
            variant="solid"
            :loading="loadingMore"
            @click="loadMore"
          >
            Load more
          </UButton>
        </div>
      </div>

    </template>
  </UContainer>
</template>
