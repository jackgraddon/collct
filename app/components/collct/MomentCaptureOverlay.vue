<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-[100] bg-black flex flex-col"
      >
        <!-- Camera viewfinder -->
        <div class="flex-1 relative overflow-hidden">
          <video
            ref="videoEl"
            autoplay
            playsinline
            muted
            class="w-full h-full object-cover"
            :class="{ 'scale-x-[-1]': facingMode === 'user' }"
          />

          <!-- Countdown badge -->
          <div
            v-if="timeRemaining > 0"
            class="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm"
          >
            <span class="text-white text-sm font-mono tabular-nums">
              {{ formatTime(timeRemaining) }}
            </span>
          </div>

          <!-- Dismiss button (top-left) -->
          <button
            class="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/80 transition-colors"
            @click="onDismiss"
          >
            <UIcon name="i-lucide-x" class="w-5 h-5" />
          </button>

          <!-- Flash overlay -->
          <Transition
            enter-active-class="transition-opacity duration-75"
            enter-from-class="opacity-100"
            enter-to-class="opacity-0"
          >
            <div v-if="showFlash" class="absolute inset-0 bg-white z-20 pointer-events-none" />
          </Transition>

          <!-- Camera error -->
          <div v-if="cameraError" class="absolute inset-0 flex flex-col items-center justify-center bg-black text-white p-8 text-center">
            <UIcon name="i-lucide-camera-off" class="w-12 h-12 text-white/50 mb-4" />
            <p class="text-lg font-medium mb-2">Camera unavailable</p>
            <p class="text-sm text-white/60 mb-6">{{ cameraError }}</p>
            <div class="flex gap-3">
              <button
                class="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors"
                @click="onDismiss"
              >
                Skip today
              </button>
              <button
                v-if="allowLibraryFallback"
                class="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
                @click="triggerLibraryFallback"
              >
                Choose from library
              </button>
            </div>
          </div>
        </div>

        <!-- Bottom controls -->
        <div class="flex items-center justify-center gap-8 py-6 px-4 bg-black">
          <!-- Library fallback (if enabled and camera unavailable) -->
          <button
            v-if="allowLibraryFallback && !cameraStream && !cameraError"
            class="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            @click="triggerLibraryFallback"
          >
            <UIcon name="i-lucide-image" class="w-5 h-5" />
          </button>
          <div v-else class="w-12" />

          <!-- Shutter button -->
          <button
            :disabled="!cameraStream || capturing"
            class="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40"
            @click="onShutter"
          >
            <div
              class="w-[58px] h-[58px] rounded-full bg-white transition-colors"
              :class="{ 'bg-red-500': capturing }"
            />
          </button>

          <!-- Flip camera (mobile only) -->
          <button
            v-if="hasMultipleCameras"
            class="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            @click="flipCamera"
          >
            <UIcon name="i-lucide-switch-camera" class="w-5 h-5" />
          </button>
          <div v-else class="w-12" />
        </div>

        <!-- Hidden file input for library fallback -->
        <input
          ref="libraryInput"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="hidden"
          @change="onLibraryFile"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
  timeRemaining: number
  allowLibraryFallback?: boolean
}>()

const emit = defineEmits<{
  capture: [blob: Blob, previewUrl: string]
  dismiss: []
}>()

const videoEl = ref<HTMLVideoElement | null>(null)
const libraryInput = ref<HTMLInputElement | null>(null)
const cameraStream = ref<MediaStream | null>(null)
const cameraError = ref('')
const capturing = ref(false)
const showFlash = ref(false)
const facingMode = ref<'user' | 'environment'>('environment')
const hasMultipleCameras = ref(false)

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function startCamera() {
  try {
    cameraError.value = ''

    // Check for multiple cameras
    const devices = await navigator.mediaDevices?.enumerateDevices() ?? []
    const videoDevices = devices.filter(d => d.kind === 'videoinput')
    hasMultipleCameras.value = videoDevices.length > 1

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facingMode.value, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })

    cameraStream.value = stream
    if (videoEl.value) {
      videoEl.value.srcObject = stream
    }
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      cameraError.value = 'Camera permission was denied. Please allow camera access in your browser settings.'
    } else if (err.name === 'NotFoundError') {
      cameraError.value = 'No camera found on this device.'
    } else {
      cameraError.value = 'Could not access camera. Please try again.'
    }
  }
}

function stopCamera() {
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach(t => t.stop())
    cameraStream.value = null
  }
}

async function flipCamera() {
  facingMode.value = facingMode.value === 'user' ? 'environment' : 'user'
  stopCamera()
  await startCamera()
}

async function onShutter() {
  if (!videoEl.value || capturing.value) return

  capturing.value = true
  showFlash.value = true

  // Brief flash effect
  setTimeout(() => { showFlash.value = false }, 100)

  try {
    const video = videoEl.value
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        const previewUrl = URL.createObjectURL(blob)
        emit('capture', blob, previewUrl)
      }
      capturing.value = false
    }, 'image/jpeg', 0.92)
  } catch {
    capturing.value = false
  }
}

function triggerLibraryFallback() {
  libraryInput.value?.click()
}

function onLibraryFile(e: Event) {
  const input = e.target as HTMLInputElement
  const selected = input.files?.[0]
  if (!selected) return
  const previewUrl = URL.createObjectURL(selected)
  emit('capture', selected, previewUrl)
  input.value = ''
}

function onDismiss() {
  stopCamera()
  emit('dismiss')
}

// Start/stop camera based on visibility
watch(() => props.visible, (v) => {
  if (v) {
    nextTick(() => startCamera())
  } else {
    stopCamera()
  }
})

onUnmounted(() => {
  stopCamera()
})
</script>
