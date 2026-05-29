<template>
  <CollctPostGrid>
    <CollctPostGridItem v-for="post in posts" :key="post.id" :post-data="post">
    </CollctPostGridItem>
  </CollctPostGrid>
</template>

<script lang="ts" setup>
const { data: posts } = await useFetch('/api/lorem/posts', {
  query: { count: 15 }
})
</script>

<style>

</style>