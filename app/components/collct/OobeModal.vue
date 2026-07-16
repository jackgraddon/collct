<script lang="ts" setup>
import { OOBE_SLIDES, OOBE_CTA_BUTTONS } from '~/utils/oobe-content'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  cta: [action: string]
}>()

const currentSlide = ref(0)
const current = computed(() => OOBE_SLIDES[currentSlide.value]!)

const nextSlide = () => {
  if (currentSlide.value < OOBE_SLIDES.length - 1) {
    currentSlide.value++
  }
}

const previousSlide = () => {
  if (currentSlide.value > 0) {
    currentSlide.value--
  }
}

async function close() {
  await $fetch('/api/user/oobe/complete', { method: 'POST' })
  currentSlide.value = 0
  emit('update:open', false)
}

async function handleCta(action: string) {
  await close()
  emit('cta', action)
}
</script>

<template>
  <UModal
    :open="props.open"
    @update:open="emit('update:open', $event)"
    :ui="{ content: 'max-w-md' }"
  >
    <div class="space-y-6">
      <!-- Progress indicator -->
      <div class="flex gap-1">
        <div
          v-for="(slide, idx) in OOBE_SLIDES"
          :key="slide.id"
          :class="[
            'h-1 flex-1 rounded-full transition-colors',
            idx <= currentSlide
              ? 'bg-primary'
              : 'bg-gray-200 dark:bg-gray-700',
          ]"
        />
      </div>

      <!-- Slide content -->
      <div class="space-y-4">
        <h2 class="text-xl font-semibold">
          {{ current.title }}
        </h2>
        <p class="text-muted leading-relaxed">
          {{ current.content }}
        </p>
      </div>

      <!-- Final screen CTA -->
      <div
        v-if="currentSlide === OOBE_SLIDES.length - 1"
        class="space-y-2 border-t pt-4"
      >
        <UButton
          v-for="btn in OOBE_CTA_BUTTONS"
          :key="btn.action"
          @click="handleCta(btn.action)"
          class="w-full"
          variant="outline"
        >
          {{ btn.label }}
        </UButton>
      </div>

      <!-- Navigation buttons -->
      <div class="flex gap-3 justify-between">
        <UButton
          v-if="currentSlide > 0"
          @click="previousSlide"
          color="neutral"
          variant="ghost"
        >
          Back
        </UButton>
        <div v-else />

        <UButton @click="close" color="neutral" variant="ghost">
          Skip
        </UButton>

        <UButton
          v-if="currentSlide < OOBE_SLIDES.length - 1"
          @click="nextSlide"
        >
          Next
        </UButton>
        <div v-else />
      </div>
    </div>
  </UModal>
</template>
