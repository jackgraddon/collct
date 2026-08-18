// https://nuxt.com/docs/api/configuration/nuxt-config
const instanceName = process.env.COLLCT_INSTANCE_NAME || 'Collct'
const instanceDescription = process.env.COLLCT_INSTANCE_DESCRIPTION || 'A friends-first photo sharing app. No algorithm. No tracking. No strangers.'

const sessionMaxAge = process.env.COLLCT_SESSION_MAX_AGE ? parseInt(process.env.COLLCT_SESSION_MAX_AGE, 10) : 60 * 60 * 24 * 30
const sessionSecure = process.env.COLLCT_SESSION_SECURE !== undefined
  ? process.env.COLLCT_SESSION_SECURE === 'true'
  : process.env.NODE_ENV === 'production'
const sessionSameSite = (process.env.COLLCT_SESSION_SAME_SITE || 'lax') as 'lax' | 'strict' | 'none'

const offlineModeEnabled = process.env.COLLCT_OFFLINE_MODE_ENABLED !== 'false'

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
    name: instanceName,
  },

  sitemap: {
    zeroRuntime: true
  },

  css: ['~/assets/css/main.css'],

  hub: {
    blob: process.env.COLLCT_BLOB_DIR
      ? { driver: 'fs', dir: process.env.COLLCT_BLOB_DIR }
      : { driver: 'vercel-blob', access: 'private' },
    db: 'postgresql',
    kv: false,
  },

  image: { provider: 'vercel' },

  session: {
    maxAge: sessionMaxAge,
    password: process.env.NUXT_SESSION_PASSWORD || 'collct-default-session-key-change-me',
    cookie: {
      secure: sessionSecure,
      sameSite: sessionSameSite,
    }
  },

  runtimeConfig: {
    cronSecret: process.env.CRON_SECRET || '',
    session: {
      maxAge: sessionMaxAge,
      cookie: {
        secure: sessionSecure,
        sameSite: sessionSameSite,
      }
    },
    public: {
      instanceName,
      adminEmail: process.env.COLLCT_ADMIN_EMAIL || 'admin@example.com',
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

  experimental: {
    tasks: true,
  },

  nitro: {
    scheduledTasks: {
      // Pre-computes daily moment time. Only fires on platforms with cron support
      // (Cloudflare Workers, etc.). On Vercel, lazy computation in GET /api/moments/today handles it.
      '0 0 * * *': ['moments:daily-compute'],
    },
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'en',
      },
      meta: [
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: instanceName },
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
      name: instanceName,
      short_name: instanceName,
      description: instanceDescription,
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
      runtimeCaching: offlineModeEnabled ? [
        {
          // Avatars — StaleWhileRevalidate (change occasionally, small, accessed everywhere)
          urlPattern: /\/_vercel\/image\?url=.*avatars/i,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheName: 'collct-avatars-cache',
            expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // All other proxied images (photos, thumbnails) — CacheFirst (immutable)
          urlPattern: /\/_vercel\/image\?url=.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'collct-images-cache',
            expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Direct blob URLs — CacheFirst
          urlPattern: /^https:\/\/.*\.blob\.vercel-storage\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'collct-blob-cache',
            expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Feed API — NetworkFirst with offline fallback
          urlPattern: /\/api\/photos(\?.*)?$/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'collct-feed-cache',
            expiration: { maxEntries: 30, maxAgeSeconds: 24 * 60 * 60 },
            networkTimeoutSeconds: 3,
          },
        },
        {
          // Comments — NetworkFirst
          urlPattern: /\/api\/photos\/\d+\/comments/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'collct-comments-cache',
            expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
            networkTimeoutSeconds: 3,
          },
        },
        {
          // Groups — NetworkFirst
          urlPattern: /\/api\/groups/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'collct-groups-cache',
            expiration: { maxEntries: 10, maxAgeSeconds: 24 * 60 * 60 },
            networkTimeoutSeconds: 3,
          },
        },
        {
          // User profiles — NetworkFirst
          urlPattern: /\/api\/user\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'collct-user-cache',
            expiration: { maxEntries: 20, maxAgeSeconds: 24 * 60 * 60 },
            networkTimeoutSeconds: 3,
          },
        },
      ] : [],
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