<template>
  <UCard title="Appearance" description="Customize the appearance of your experience">
    <UColorModeSelect />
    <ULink to="/design">Check out the design page</ULink>
  </UCard>
</template>

<script lang="ts" setup>
definePageMeta({ title:'Settings', description: 'Manage your settings', layout : 'page'}); 

const user = ref(
  { name : 'John Doe'}, 
)
</script>

<style>

</style>