export function useRecoveryCodes() {
  const codes = ref<string[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function generate() {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<{ codes: string[] }>('/api/auth/recovery/generate', {
        method: 'POST',
      })
      codes.value = data.codes
    } catch (e: any) {
      error.value = e.data?.message ?? 'Failed to generate codes'
    } finally {
      loading.value = false
    }
  }

  async function redeem(email: string, code: string) {
    return $fetch('/api/auth/recovery/redeem', {
      method: 'POST',
      body: { email, code },
    })
  }

  return { codes, loading, error, generate, redeem }
}
