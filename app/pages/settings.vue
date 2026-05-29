<template>
  <UPageCard class="w-full">
    <UTabs :items="tabs" variant="link">
      <template #appearance>
        <UCard title="Appearance" description="Customize your experience">
          <UFormField label="Color Theme">
            <UColorModeSelect />
          </UFormField>
          <template #footer>
            <p>Check out the <ULink to="/design">design page</ULink> to see your changes.</p>
          </template>
        </UCard>
      </template>
      <template>
        <UCard title="" description="">
        </UCard>
      </template>
    </UTabs>
  </UPageCard>
</template>

<script lang="ts" setup>
definePageMeta({ title:'Settings', description: 'Manage your settings', layout : 'page'}); 

const user = ref(
  { name : 'John Doe'}, 
)

const tabs = [
  { slot: 'appearance', icon: 'i-lucide-palette' },
]
</script>

<style>

</style>