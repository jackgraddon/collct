<script lang="ts" setup>
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  uploaded: [post: PostData]
}>()

const toast = useToast()
const router = useRouter()

// File inputs
const cameraInput = ref<HTMLInputElement | null>(null)
const libraryInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const preview = ref<string | null>(null)
const caption = ref('')
const uploading = ref(false)

// Groups — only fetch when the modal opens, not on component mount
const { data: groupsData } = useFetch<{ groups: GroupData[] }>('/api/groups', {
  watch: [() => props.open],
  immediate: false,
})

const selectedGroupIds = ref<number[]>([])
const nonPublicGroups = computed(() => groupsData.value?.groups.filter((g) => !g.isPublic) ?? [])
const hasPrivateGroups = computed(() => nonPublicGroups.value.length > 0)

// Start with no groups selected — empty selection = post publicly to everyone
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    selectedGroupIds.value = []
  }
})

const canSubmit = computed(() => !!file.value)

// Create group confirmation
const showCreateGroupDialog = ref(false)

function triggerCameraCapture() {
  cameraInput.value?.click()
}

function triggerLibraryPicker() {
  libraryInput.value?.click()
}

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
  if (cameraInput.value) cameraInput.value.value = ''
  if (libraryInput.value) libraryInput.value.value = ''
}

function close() {
  clear()
  emit('update:open', false)
}

function goToGroups() {
  showCreateGroupDialog.value = false
  close()
  router.push('/groups')
}

async function upload() {
  if (!file.value || !canSubmit.value) return

  uploading.value = true
  try {
    const form = new FormData()
    form.append('photo', file.value)
    if (caption.value.trim()) form.append('caption', caption.value.trim())
    form.append('groupIds', JSON.stringify(selectedGroupIds.value))

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
  <UModal :open="props.open" @update:open="emit('update:open', $event)" :ui="{ content: 'flex flex-col h-full max-h-[100dvh] md:max-h-[85vh]' }">
    <template #content>
      <div class="flex flex-col h-full">

        <!-- Fixed header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div class="flex items-center gap-2">
            <UIcon name="i-solar-upload-square-linear" class="w-5 h-5 text-primary" />
            <span class="font-semibold">Upload photo</span>
          </div>
          <UButton color="neutral" variant="ghost" icon="i-lucide-x" size="xs" @click="close" />
        </div>

        <!-- Scrollable content -->
        <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          <!-- Preview (shown after file selected) -->
          <div v-if="preview" class="relative rounded-xl border-2 border-solid border-primary overflow-hidden">
            <img
              :src="preview"
              alt="Preview"
              class="w-full h-auto max-h-80 object-cover"
            />
          </div>

          <!-- Source buttons (shown when no file selected) -->
          <div v-else class="grid grid-cols-2 gap-3">
            <button
              class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 py-10 text-center transition-colors hover:border-primary hover:bg-primary/5"
              @click="triggerCameraCapture"
            >
              <UIcon name="i-lucide-camera" class="w-8 h-8 text-muted" />
              <div>
                <p class="font-medium text-sm">Take Photo</p>
                <p class="text-muted text-xs mt-1">Open camera</p>
              </div>
            </button>
            <button
              class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 py-10 text-center transition-colors hover:border-primary hover:bg-primary/5"
              @click="triggerLibraryPicker"
            >
              <UIcon name="i-lucide-image" class="w-8 h-8 text-muted" />
              <div>
                <p class="font-medium text-sm">Choose from Library</p>
                <p class="text-muted text-xs mt-1">JPEG, PNG, WebP, GIF</p>
              </div>
            </button>
          </div>

          <!-- Hidden file inputs -->
          <input
            ref="cameraInput"
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            @change="onFileChange"
          />
          <input
            ref="libraryInput"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            class="hidden"
            @change="onFileChange"
          />

          <!-- Change file -->
          <div v-if="preview" class="flex justify-end">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-refresh-cw"
              @click="triggerLibraryPicker"
            >
              Change photo
            </UButton>
          </div>

          <!-- Caption -->
          <UTextarea
            v-model="caption"
            placeholder="Add a caption..."
            :rows="3"
            :maxlength="500"
          />
          <p class="text-xs text-muted text-right -mt-2">{{ caption.length }} / 500</p>

        </div>

        <!-- Fixed footer: groups + upload button -->
        <div class="border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 space-y-4 shrink-0">

          <!-- Visible to (only when user has private groups) -->
          <div v-if="hasPrivateGroups" class="space-y-2">
            <p class="text-xs font-medium text-muted uppercase tracking-wider">Visible to</p>
            <div class="space-y-1.5">
              <label
                v-for="group in nonPublicGroups"
                :key="group.id"
                class="flex items-center gap-2.5 cursor-pointer group"
              >
                <UCheckbox
                  :model-value="selectedGroupIds.includes(group.id)"
                  @update:model-value="(val: boolean | 'indeterminate') => {
                    if (val === true) {
                      selectedGroupIds.push(group.id)
                    } else if (val === false) {
                      selectedGroupIds = selectedGroupIds.filter(id => id !== group.id)
                    }
                  }"
                />
                <span class="text-sm text-default">{{ group.name }}</span>
              </label>
            </div>
            <p class="text-xs text-muted">
              Visible only to members of selected groups. Uncheck all to post publicly.
            </p>
          </div>

          <!-- No private groups: public by default -->
          <div v-if="!hasPrivateGroups" class="rounded-lg bg-muted/30 p-3 space-y-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-solar-global-linear" class="w-4 h-4 text-muted" />
              <p class="text-xs text-muted">Visible to everyone on this server</p>
            </div>
            <p class="text-xs text-muted">
              Want to share privately?
              <button class="text-primary hover:underline font-medium" @click.prevent="showCreateGroupDialog = true">
                Create a group
              </button>
              to control who sees your photos.
            </p>
          </div>

          <!-- Upload button -->
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="close">Cancel</UButton>
            <UButton
              color="primary"
              variant="solid"
              :loading="uploading"
              :disabled="!canSubmit"
              icon="i-solar-upload-square-linear"
              @click="upload"
            >
              Upload
            </UButton>
          </div>

        </div>

      </div>
    </template>
  </UModal>

  <!-- Create group confirmation dialog -->
  <UModal v-model:open="showCreateGroupDialog">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-solar-users-group-rounded-linear" class="w-5 h-5 text-primary" />
            <span class="font-semibold">Create a group?</span>
          </div>
        </template>

        <p class="text-sm text-muted">
          You'll be taken to the Groups page to create your group. Your current post draft will not be saved.
        </p>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="showCreateGroupDialog = false">
              Stay here
            </UButton>
            <UButton color="primary" variant="solid" @click="goToGroups">
              Go to Groups
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

<style scoped>
:deep(.ui-modal-content) {
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  max-height: 100dvh !important;
}

:deep(.ui-modal-body) {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 !important;
  min-height: 0 !important;
}

@media (max-width: 768px) {
  :deep(.ui-modal) {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    max-height: 100dvh !important;
    height: 100dvh !important;
    border-radius: 0 !important;
    margin: 0 !important;
  }

  :deep(.ui-modal-content) {
    max-height: 100dvh !important;
    height: 100dvh !important;
    border-radius: 0 !important;
  }
}

img {
  max-height: 320px;
  object-fit: cover;
}
</style>
