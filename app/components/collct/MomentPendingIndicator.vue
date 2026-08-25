<template>
  <Transition
    enter-active-class="transition ease-out duration-200"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition ease-in duration-150"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="visible"
      class="mb-4 px-4 py-3 rounded-lg border flex items-center gap-3"
      :class="isError
        ? 'bg-red-500/10 border-red-500/20 text-red-400'
        : 'bg-jungle-teal-500/10 border-jungle-teal-500/20 text-jungle-teal-400'"
    >
      <UIcon
        :name="isError ? 'i-lucide-alert-triangle' : 'i-lucide-clock'"
        class="w-5 h-5 shrink-0"
      />
      <div class="flex-1 min-w-0">
        <p v-if="isError" class="text-sm font-medium">
          Moment upload failed
          <span v-if="retryCount > 0" class="font-normal opacity-70">
            ({{ retryCount }} retries)
          </span>
        </p>
        <p v-else class="text-sm font-medium">
          Moment upload pending...
        </p>
        <p v-if="isError && errorMessage" class="text-xs opacity-70 mt-0.5 truncate">
          {{ errorMessage }}
        </p>
      </div>
      <button
        v-if="isError"
        class="text-xs font-medium px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors shrink-0"
        @click="$emit('retry')"
      >
        Retry
      </button>
    </div>
  </Transition>
</template>

<script lang="ts" setup>
defineProps<{
  visible: boolean
  isError: boolean
  errorMessage: string
  retryCount: number
}>()

defineEmits<{
  retry: []
}>()
</script>
