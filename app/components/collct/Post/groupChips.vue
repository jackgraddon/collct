<script lang="ts" setup>
const props = defineProps<{
  groups?: { id: number; name: string }[]
}>()

const displayGroups = computed(() => {
  if (!props.groups || props.groups.length === 0) return []
  // Suppress the Public label when it's the only one
  if (props.groups.length === 1 && props.groups[0]!.name === 'Public') return []
  return props.groups
})
</script>

<template>
  <div v-if="displayGroups.length > 0" class="flex flex-wrap gap-1">
    <span
      v-for="group in displayGroups"
      :key="group.id"
      class="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-600 dark:text-neutral-300"
    >
      {{ group.name }}
    </span>
  </div>
</template>
