<script setup lang="ts">
// Access the global session state provided by nuxt-auth-utils
const { loggedIn, clear } = useUserSession()

async function handleLogout() {
  try {
    // Tell the server to destroy the session cookie
    await $fetch('/api/auth/logout', { method: 'POST' })
    
    // Clear local client session state and redirect
    clear()
    await navigateTo('/')
  } catch (error) {
    console.error('Failed to log out:', error)
  }
}
</script>

<template>
  <UButton v-if="loggedIn" @click="handleLogout">
    Log Out
  </UButton>
</template>