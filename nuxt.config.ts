// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  typescript: {
    tsConfig: {
      include: ['types/**/*.d.ts']
    }
  },

  site: {
    url: "https://collct.vercel.app/",
    name: 'Collct',
  },

  css: ['~/assets/css/main.css'],

  hub: {
    blob: {
      driver: 'vercel-blob',
      access: 'private',
    },
    db: 'postgresql',
  },

  image: { provider: 'none' },

  auth: {
    webAuthn: true,
  },

  modules: [
    '@nuxt/fonts',
    '@vite-pwa/nuxt',
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/icon',
    'nuxt-auth-utils',
    '@nuxtjs/seo',
    '@nuxt/ui',
    '@nuxthub/core'
  ],


  $production: {
    image: {
      provider: 'vercel'
    }
  }
})
