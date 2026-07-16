<script lang="ts" setup>
const props = defineProps<{
  groups?: { id: number; name: string; icon?: string | null; color?: string | null }[]
}>()

const DEFAULT_COLOR = '#6B7280'
const DEFAULT_ICON = '📌'

const displayGroups = computed(() => {
  if (!props.groups || props.groups.length === 0) return []
  // Suppress the Public label when it's the only one
  if (props.groups.length === 1 && props.groups[0]!.name === 'Public') return []
  return props.groups
})

function textColor(hex: string | null | undefined): string {
  const c = hex || DEFAULT_COLOR
  const r = parseInt(c.slice(1, 3), 16)
  const g = parseInt(c.slice(3, 5), 16)
  const b = parseInt(c.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000000' : '#FFFFFF'
}
</script>

<template>
  <div v-if="displayGroups.length > 0" class="flex flex-wrap gap-1">
    <!-- Single group: emoji + name pill -->
    <template v-if="displayGroups.length === 1">
      <span
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
        :style="{
          backgroundColor: (displayGroups[0]!.color || DEFAULT_COLOR) + '20',
          color: displayGroups[0]!.color || DEFAULT_COLOR,
        }"
      >
        <span class="text-xs">{{ displayGroups[0]!.icon || DEFAULT_ICON }}</span>
        {{ displayGroups[0]!.name }}
      </span>
    </template>

    <!-- Multiple groups: emoji badges only -->
    <template v-else>
      <span
        v-for="group in displayGroups"
        :key="group.id"
        class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px]"
        :title="group.name"
        :style="{
          backgroundColor: (group.color || DEFAULT_COLOR) + '20',
          color: group.color || DEFAULT_COLOR,
        }"
      >
        {{ group.icon || DEFAULT_ICON }}
      </span>
    </template>
  </div>
</template>
