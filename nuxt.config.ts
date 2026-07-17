// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  devServer: {
    https: {
      key: './localhost-key.pem',
      cert: './localhost.pem',
    }
  },

  typescript: {
    tsConfig: {
      include: ['types/**/*.d.ts']
    }
  },

  site: {
    url: "https://collct.vercel.app/",
    name: 'Collct',
  },

  sitemap: {
    zeroRuntime: true
  },

  css: ['~/assets/css/main.css'],

  hub: {
    blob: { access: 'private' },
    db: 'postgresql',
    kv: false,
  },

  image: { provider: 'vercel' },

  runtimeConfig: {
    session: {
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  },

  auth: {
    webAuthn: true,
  },

  qrcode: {
    options: {
      variant: 'rounded',
      radius: 1,
      blackColor: 'var(--ui-text-highlighted)',
      whiteColor: 'var(--ui-bg)',
    },
  },

  app: {
    head: {
      title: 'Collct',
      htmlAttrs: {
        lang: 'en',
      },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },

  pwa: {
    manifest: {
      name: 'collct',
      short_name: 'Collct',
      description: 'A Progressive Web App',
      theme_color: '#fba903',
      background_color: '#fba903',
      display: 'standalone',
      icons: [
        {
          src: '/icon-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/icon-192x192-maskable.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        },
        {
          src: '/icon-512x512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
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
    '@nuxthub/core',
    'nuxt-qrcode',
  ],
})