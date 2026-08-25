interface MomentDraft {
  capturedAt: string
  groupIds: number[]
  photoDataUrl: string
  photoType: string
  createdAt: string
  retryCount: number
}

type CaptureFlowState = 'idle' | 'capturing' | 'captured' | 'selecting-groups' | 'uploading' | 'pending' | 'error' | 'missed'

const DRAFT_KEY_PREFIX = 'moment_draft_'
const MAX_RETRIES = 5
const RETRY_INTERVAL_MS = 30_000

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function getDraftKey(): string {
  return `${DRAFT_KEY_PREFIX}${getTodayKey()}`
}

function loadDraft(): MomentDraft | null {
  if (import.meta.server) return null
  try {
    const raw = localStorage.getItem(getDraftKey())
    if (!raw) return null
    return JSON.parse(raw) as MomentDraft
  } catch {
    return null
  }
}

function saveDraft(draft: MomentDraft): void {
  if (import.meta.server) return
  try {
    localStorage.setItem(getDraftKey(), JSON.stringify(draft))
  } catch {
    // Storage full or unavailable
  }
}

function clearDraft(): void {
  if (import.meta.server) return
  try {
    localStorage.removeItem(getDraftKey())
  } catch {
    // ignore
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function dataUrlToBlob(dataUrl: string, type: string): Blob {
  const parts = dataUrl.split(',')
  const byteString = atob(parts[1]!)
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  return new Blob([ab], { type })
}

export function useMomentCapture() {
  const flowState = ref<CaptureFlowState>('idle')
  const capturedAt = ref<Date | null>(null)
  const capturedBlob = ref<Blob | null>(null)
  const capturedPreviewUrl = ref<string | null>(null)
  const selectedGroupIds = ref<number[]>([])
  const errorMessage = ref('')
  const retryCount = ref(0)
  const lastUploadError = ref('')

  let retryTimer: ReturnType<typeof setInterval> | null = null
  let networkListener: (() => void) | null = null

  const isPending = computed(() => flowState.value === 'pending')
  const isUploading = computed(() => flowState.value === 'uploading')
  const hasDraft = computed(() => flowState.value === 'pending' || flowState.value === 'error')

  function startCapture() {
    flowState.value = 'capturing'
    capturedAt.value = null
    capturedBlob.value = null
    capturedPreviewUrl.value = null
    selectedGroupIds.value = []
    errorMessage.value = ''
    lastUploadError.value = ''
    retryCount.value = 0
  }

  function onShutterTap(blob: Blob, previewUrl: string) {
    capturedAt.value = new Date()
    capturedBlob.value = blob
    capturedPreviewUrl.value = previewUrl
    flowState.value = 'captured'
  }

  function enterGroupSelection(groups: Array<{ id: number }>) {
    selectedGroupIds.value = groups.map(g => g.id)
    flowState.value = 'selecting-groups'
  }

  function setGroupIds(ids: number[]) {
    selectedGroupIds.value = ids
  }

  async function submitUpload(): Promise<boolean> {
    if (!capturedBlob.value || !capturedAt.value) {
      errorMessage.value = 'Missing capture data'
      return false
    }

    flowState.value = 'uploading'
    errorMessage.value = ''

    try {
      const form = new FormData()
      form.append('photo', capturedBlob.value, `moment-${Date.now()}.jpg`)
      form.append('groupIds', JSON.stringify(selectedGroupIds.value))
      form.append('isMoment', 'true')
      form.append('momentCapturedAt', capturedAt.value.toISOString())

      await $fetch('/api/photos', { method: 'POST', body: form })

      clearDraft()
      stopRetry()
      stopNetworkListener()
      cleanupPreview()
      flowState.value = 'idle'
      return true
    } catch (err: any) {
      lastUploadError.value = err?.data?.statusMessage || err?.message || 'Upload failed'
      await saveAsDraft()
      flowState.value = 'error'
      startRetry()
      return false
    }
  }

  async function saveAsDraft() {
    if (!capturedBlob.value || !capturedAt.value) return

    const dataUrl = await blobToDataUrl(capturedBlob.value)

    const draft: MomentDraft = {
      capturedAt: capturedAt.value.toISOString(),
      groupIds: [...selectedGroupIds.value],
      photoDataUrl: dataUrl,
      photoType: capturedBlob.value.type,
      createdAt: new Date().toISOString(),
      retryCount: retryCount.value,
    }

    saveDraft(draft)
  }

  async function retryUpload(): Promise<boolean> {
    const draft = loadDraft()
    if (!draft) {
      flowState.value = 'idle'
      return false
    }

    flowState.value = 'uploading'
    lastUploadError.value = ''

    try {
      const blob = dataUrlToBlob(draft.photoDataUrl, draft.photoType)
      const form = new FormData()
      form.append('photo', blob, `moment-${Date.now()}.jpg`)
      form.append('groupIds', JSON.stringify(draft.groupIds))
      form.append('isMoment', 'true')
      form.append('momentCapturedAt', draft.capturedAt)

      await $fetch('/api/photos', { method: 'POST', body: form })

      clearDraft()
      stopRetry()
      stopNetworkListener()
      cleanupPreview()
      flowState.value = 'idle'
      return true
    } catch (err: any) {
      retryCount.value++
      lastUploadError.value = err?.data?.statusMessage || err?.message || 'Upload failed'

      if (retryCount.value >= MAX_RETRIES) {
        flowState.value = 'error'
        stopRetry()
        return false
      }

      const d = loadDraft()
      if (d) {
        d.retryCount = retryCount.value
        saveDraft(d)
      }

      flowState.value = 'pending'
      return false
    }
  }

  function resetFlow() {
    clearDraft()
    stopRetry()
    stopNetworkListener()
    cleanupPreview()
    flowState.value = 'idle'
    capturedAt.value = null
    capturedBlob.value = null
    capturedPreviewUrl.value = null
    selectedGroupIds.value = []
    errorMessage.value = ''
    lastUploadError.value = ''
    retryCount.value = 0
  }

  function dismissMissedAndReset() {
    clearDraft()
    stopRetry()
    stopNetworkListener()
    cleanupPreview()
    flowState.value = 'missed'
  }

  function startRetry() {
    stopRetry()
    retryTimer = setInterval(async () => {
      if (flowState.value !== 'pending' && flowState.value !== 'error') {
        stopRetry()
        return
      }
      flowState.value = 'pending'
      await retryUpload()
    }, RETRY_INTERVAL_MS)
  }

  function stopRetry() {
    if (retryTimer) {
      clearInterval(retryTimer)
      retryTimer = null
    }
  }

  function startNetworkListener() {
    stopNetworkListener()
    if (import.meta.server) return

    const handler = async () => {
      if (navigator.onLine && (flowState.value === 'pending' || flowState.value === 'error')) {
        flowState.value = 'pending'
        await retryUpload()
      }
    }
    window.addEventListener('online', handler)
    networkListener = () => window.removeEventListener('online', handler)
  }

  function stopNetworkListener() {
    if (networkListener) {
      networkListener()
      networkListener = null
    }
  }

  function cleanupPreview() {
    if (capturedPreviewUrl.value) {
      URL.revokeObjectURL(capturedPreviewUrl.value)
      capturedPreviewUrl.value = null
    }
  }

  onMounted(() => {
    const draft = loadDraft()
    if (draft) {
      const blob = dataUrlToBlob(draft.photoDataUrl, draft.photoType)
      capturedBlob.value = blob
      capturedPreviewUrl.value = URL.createObjectURL(blob)
      capturedAt.value = new Date(draft.capturedAt)
      selectedGroupIds.value = draft.groupIds
      retryCount.value = draft.retryCount
      flowState.value = draft.retryCount >= MAX_RETRIES ? 'error' : 'pending'
      startRetry()
      startNetworkListener()
    }
  })

  onUnmounted(() => {
    stopRetry()
    stopNetworkListener()
  })

  return {
    flowState,
    capturedAt,
    capturedBlob,
    capturedPreviewUrl,
    selectedGroupIds,
    errorMessage,
    retryCount,
    lastUploadError,
    isPending,
    isUploading,
    hasDraft,
    startCapture,
    onShutterTap,
    enterGroupSelection,
    setGroupIds,
    submitUpload,
    retryUpload,
    resetFlow,
    dismissMissedAndReset,
  }
}
