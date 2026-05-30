<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :schema="activeSchema"
        :title="isLogin ? 'Welcome back' : 'Create an account'"
        :description="isLogin ? 'Enter your credentials to access your feed.' : 'Sign up to start sharing photos.'"
        icon="solar:shield-user-linear"
        :fields="activeFields"
        :loading="loading"
        @submit="onSubmit"
      >
        <template #footer>
          <div class="text-sm text-center text-gray-500 dark:text-gray-400 mt-4">
            {{ isLogin ? "Don't have an account?" : "Already have an account?" }}
            <UButton 
              variant="link" 
              color="primary" 
              class="p-0"
              @click="toggleMode"
            >
              {{ isLogin ? 'Sign up' : 'Log in' }}
            </UButton>
          </div>
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>

<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'

const isLogin = ref(true)
const loading = ref(false)
const { fetch: refreshSession } = useUserSession()
const toast = useToast()

// Dynamically generate fields based on state
const activeFields = computed<AuthFormField[]>(() => {
  const baseFields: AuthFormField[] = [
    { name: 'email', type: 'email', label: 'Email', placeholder: 'Enter your email', required: true },
    { name: 'password', type: 'password', label: 'Password', placeholder: 'Enter your password', required: true }
  ]
  
  if (!isLogin.value) {
    baseFields.unshift({ 
      name: 'name', 
      type: 'text', 
      label: 'Full Name', 
      placeholder: 'Enter your name', 
      required: true 
    })
  }
  
  return baseFields
})

// Dynamically generate validation schema
const activeSchema = computed(() => {
  const baseSchema = {
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Must be at least 8 characters')
  }

  if (!isLogin.value) {
    return z.object({
      ...baseSchema,
      name: z.string().min(2, 'Name is required')
    })
  }

  return z.object(baseSchema)
})

function toggleMode() {
  isLogin.value = !isLogin.value
}

async function onSubmit(payload: FormSubmitEvent<any>) {
  loading.value = true
  
  try {
    const endpoint = isLogin.value ? '/api/auth/login' : '/api/auth/register'
    
    await $fetch(endpoint, {
      method: 'POST',
      body: payload.data
    })

    // Hydrate the session state globally
    await refreshSession()
    
    // Redirect to the core app experience
    navigateTo('/feed')
    
  } catch (error: any) {
    toast.add({
      title: 'Authentication Failed',
      description: error.data?.statusMessage || 'An error occurred. Please try again.',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}
</script>