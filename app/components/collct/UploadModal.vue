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

// File input
const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const preview = ref<string | null>(null)
const caption = ref('')
const uploading = ref(false)

// Groups
const { data: groupsData } = await useFetch<{ groups: GroupData[] }>('/api/groups', {
  watch: [() => props.open],
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
  <UModal :open="props.open" @update:open="emit('update:open', $event)">
    <template #content>
      <div class="flex flex-col h-[100dvh] md:h-auto md:max-h-[85vh]">

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
              class="w-full h-auto max-h-80 object-cover"
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
@media (max-width: 768px) {
  :deep(.ui-dialog) {
    max-height: 100vh !important;
    height: 100vh !important;
  }

  :deep(.ui-dialog__content) {
    max-height: 100vh !important;
  }
}

img {
  max-height: 320px;
  object-fit: cover;
}
</style>
