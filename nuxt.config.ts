// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: import.meta.dev },

  devServer: {
    https: {
      key: './localhost-key.pem',
      cert: './localhost.pem',
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
    blob: { driver: 'vercel-blob', access: 'private' },
    db: 'postgresql',
    kv: false,
  },

  image: { provider: 'vercel' },

  runtimeConfig: {
    vapidPublicKey: '',
    vapidPrivateKey: '',
    session: {
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
    public: {
      vapidPublicKey: '',
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

  experimental: {},

  app: {
    head: {
      htmlAttrs: {
        lang: 'en',
      },
      meta: [
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Collct' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'theme-color', content: '#fba903' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'apple-touch-icon', sizes: '512x512', href: '/icon-512x512.png' },
      ],
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    client: {
      installPrompt: true,
    },
    manifest: {
      id: '/',
      name: 'Collct',
      short_name: 'Collct',
      description: 'A friends-first photo sharing app. No algorithm. No tracking. No strangers.',
      theme_color: '#fba903',
      background_color: '#fba903',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'portrait-primary',
      start_url: '/',
      scope: '/',
      lang: 'en',
      dir: 'ltr',
      categories: ['social', 'photo'],
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
      screenshots: [
        {
          src: '/screenshots/feed-mobile.png',
          sizes: '1080x2340',
          type: 'image/png',
          form_factor: 'narrow',
          label: 'Photo feed',
        },
        {
          src: '/screenshots/feed-desktop.png',
          sizes: '1920x1080',
          type: 'image/png',
          form_factor: 'wide',
          label: 'Photo feed on desktop',
        },
      ],
      shortcuts: [
        {
          name: 'Upload Photo',
          short_name: 'Upload',
          description: 'Upload a new photo',
          url: '/?upload=true',
          icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
        },
        {
          name: 'Groups',
          short_name: 'Groups',
          description: 'View your groups',
          url: '/groups',
          icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      importScripts: ['/push-handler.js'],
      runtimeCaching: [
        {
          // All images served through NuxtImg / Vercel Image proxy
          // (photos, thumbnails, avatars — covers everything)
          urlPattern: /\/_vercel\/image\?url=.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'collct-images-cache',
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          // Raw blob URLs (direct access, e.g. from API or fallback)
          urlPattern: /^https:\/\/.*\.blob\.vercel-storage\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'collct-photos-cache',
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60 * 24 * 7,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          // Feed API responses — serve cached data when offline
          urlPattern: /\/api\/photos(\?.*)?$/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'collct-feed-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24,
            },
            networkTimeoutSeconds: 3,
          },
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