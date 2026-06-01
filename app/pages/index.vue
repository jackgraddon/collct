<template>
  <UPageHero
    title="Welcome to Collct"
    description="A new kind of social media designed to connect you to your friends, and that's it."
    :links
    class="my-[15vh]"
    />
  <UPageSection
    id="about"
    headline="What is Collct?"
    title="Friends-First Social Media"
    description="Collct is a new kind of social media that puts you and your friends at the center of the show. Gone are annoying ads, suggested content, 'people you may know', and all of the annoyances the other guys shove in your face. Collct only shows you, your friends, and their photos. That's it."
  />
  <UPageSection
    id="private"
    headline="Completely Private"
    title="Connect with Collct"
    :features
  />
</template>

<script lang="ts" setup>
definePageMeta({
  middleware: ['user-logged-in'], 
})

import type { ButtonProps, PageFeatureProps } from '@nuxt/ui'

const links = ref<ButtonProps[]>([
  {
    label: 'See Your Feed',
    to: '/feed',
  },
  {
    label: 'Learn More',
    to: '#about',
    color: 'neutral',
    variant: 'subtle',
  }
])

const aboutProps = ref<PageFeatureProps[]>  ([
  {
    title : ''
  },
  {
    title: ''
  }
])

const features = ref<PageFeatureProps[]>([
  {
    title: 'No Algorithm',
    description: 'You create what you see, no algorithm pulling the strings behind the scenes.' ,
    icon: 'solar:chef-hat-heart-linear',
  },
  {
    title: 'No Tracking',
    description: "We save the bare minimum. No habits, no preferences, no targeting, nothing.",
    icon: 'solar:eye-closed-linear',
  },
  {
    title: 'No Strangers',
    description: 'Only your friends can see each others photos. You control who sees your posts.',
    icon: 'solar:users-group-two-rounded-linear',
  }
])
</script>

<style scoped>

</style>