<script lang="ts" setup>
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  uploaded: [post: PostData]
}>()

const toast = useToast()

// File input
const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const preview = ref<string | null>(null)
const caption = ref('')
const uploading = ref(false)

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const selected = input.files?.[0]
  if (!selected) return

  file.value = selected
  preview.value = URL.createObjectURL(selected)
}

function clear() {
  file.value = null
  caption.value = ''
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function close() {
  clear()
  emit('update:open', false)
}

async function upload() {
  if (!file.value) return

  uploading.value = true
  try {
    const form = new FormData()
    form.append('photo', file.value)
    if (caption.value.trim()) form.append('caption', caption.value.trim())

    const post = await $fetch<PostData>('/api/photos', { method: 'POST', body: form })

    toast.add({ title: 'Photo uploaded', color: 'success', icon: 'i-lucide-circle-check' })
    emit('uploaded', post)
    close()
  } catch {
    toast.add({ title: 'Upload failed', description: 'Please try again.', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <UModal :open="props.open" @update:open="emit('update:open', $event)">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-solar-upload-square-linear" class="w-5 h-5 text-primary" />
              <span class="font-semibold">Upload photo</span>
            </div>
            <UButton color="neutral" variant="ghost" icon="i-lucide-x" size="xs" @click="close" />
          </div>
        </template>

        <div class="space-y-4">

          <!-- Drop zone / preview -->
          <div
            class="relative rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 overflow-hidden cursor-pointer transition-colors hover:border-primary"
            :class="preview ? 'border-solid border-primary' : ''"
            @click="fileInput?.click()"
          >
            <!-- Preview -->
            <img
              v-if="preview"
              :src="preview"
              alt="Preview"
              class="w-full h-auto max-h-80 object-contain"
            />

            <!-- Placeholder -->
            <div v-else class="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
              <UIcon name="i-solar-camera-add-linear" class="w-10 h-10 text-muted" />
              <div>
                <p class="font-medium text-sm">Click to select a photo</p>
                <p class="text-muted text-xs mt-1">JPEG, PNG, WebP or GIF — max 10 MB</p>
              </div>
            </div>

            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              class="hidden"
              @change="onFileChange"
            />
          </div>

          <!-- Change file -->
          <div v-if="preview" class="flex justify-end">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-refresh-cw"
              @click="fileInput?.click()"
            >
              Change photo
            </UButton>
          </div>

          <!-- Caption -->
          <UTextarea
            v-model="caption"
            placeholder="Add a caption…"
            :rows="3"
            :maxlength="500"
          />
          <p class="text-xs text-muted text-right -mt-2">{{ caption.length }} / 500</p>

        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="close">Cancel</UButton>
            <UButton
              color="primary"
              variant="solid"
              :loading="uploading"
              :disabled="!file"
              icon="i-solar-upload-square-linear"
              @click="upload"
            >
              Upload
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>