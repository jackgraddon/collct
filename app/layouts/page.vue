<template>
  <CollctHeader />
  <UPage>
    <UPageAside>
      <template #left />
    </UPageAside>
    <UPageHeader :title="title" :description="description" class="border-b-0"/>
    <UPageBody>
      <slot />
    </UPageBody>
    <UPageAside>
      <template #right />
    </UPageAside>
  </UPage>
</template>

<script lang="ts" setup>
const route = useRoute()

const title = computed(() => route.meta.title as string)
const description = computed(() => route.meta.description as string)
</script>

<style>

</style>