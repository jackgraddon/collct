export function useTotp() {
  const uri = ref<string | null>(null)
  const secret = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function setup() {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<{ uri: string, secret: string }>('/api/auth/totp/setup', {
        method: 'POST',
      })
      uri.value = data.uri
      secret.value = data.secret
    } catch (e: any) {
      error.value = e.data?.message ?? 'Setup failed'
    } finally {
      loading.value = false
    }
  }

  async function verify(token: string) {
    return $fetch('/api/auth/totp/verify', { method: 'POST', body: { token } })
  }

  async function challenge(token: string) {
    return $fetch('/api/auth/totp/challenge', { method: 'POST', body: { token } })
  }

  async function disable(body: { token?: string, recoveryCode?: string }) {
    return $fetch('/api/auth/totp/disable', { method: 'POST', body })
  }

  return { uri, secret, loading, error, setup, verify, challenge, disable }
}
