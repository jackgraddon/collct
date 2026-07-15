<script lang="ts" setup>
definePageMeta({ layout: 'page' })

const route = useRoute()
const router = useRouter()
const toast = useToast()

const code = route.params.code as string

const joining = ref(false)
const joined = ref(false)

async function redeemInvite() {
  joining.value = true
  try {
    await $fetch('/api/groups/invites/redeem', {
      method: 'POST',
      body: { code },
    })
    joined.value = true
    toast.add({ title: 'Joined group!', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (e: any) {
    toast.add({
      title: 'Failed to join group',
      description: e.data?.statusMessage || 'Invalid or expired invite code.',
      color: 'error',
      icon: 'i-lucide-triangle-alert',
    })
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="max-w-md mx-auto py-20 text-center space-y-6">
    <!-- Already joined -->
    <template v-if="joined">
      <div class="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
        <UIcon name="i-lucide-circle-check" class="w-8 h-8 text-success" />
      </div>
      <h1 class="text-xl font-semibold">You're in!</h1>
      <p class="text-muted text-sm">You've joined the group. Your future photos can now be shared with them.</p>
      <div class="flex justify-center gap-3">
        <UButton to="/feed" color="primary" variant="solid">Go to feed</UButton>
        <UButton to="/groups" color="neutral" variant="ghost">View groups</UButton>
      </div>
    </template>

    <!-- Invite prompt -->
    <template v-else>
      <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <UIcon name="i-solar-users-group-rounded-linear" class="w-8 h-8 text-primary" />
      </div>
      <h1 class="text-xl font-semibold">Join a group</h1>
      <p class="text-muted text-sm">
        You've been invited to join a group on Collct. Join to share and see private photos.
      </p>
      <p class="text-xs text-muted font-mono bg-muted/30 rounded-lg px-3 py-2 inline-block">
        {{ code }}
      </p>

      <div class="flex justify-center gap-3 pt-2">
        <UButton to="/feed" color="neutral" variant="ghost">Cancel</UButton>
        <UButton
          color="primary"
          variant="solid"
          :loading="joining"
          @click="redeemInvite"
        >
          Join group
        </UButton>
      </div>
    </template>
  </div>
</template>
