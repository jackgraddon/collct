import { defineNuxtModule, addServerHandler, createResolver } from 'nuxt/kit'
import { addCustomTab } from '@nuxt/devtools-kit'

export default defineNuxtModule({
  meta: { name: 'devtools-login' },
  setup(_options, nuxt) {
    if (!nuxt.options.dev) return

    const resolver = createResolver(import.meta.url)

    addServerHandler({
      route: '/__dev-login__/panel',
      handler: resolver.resolve('./runtime/server/panel.get'),
    })

    addServerHandler({
      route: '/api/dev/login-as',
      handler: resolver.resolve('./runtime/server/login-as.post'),
    })

    addServerHandler({
      route: '/api/dev/moment-control',
      handler: resolver.resolve('./runtime/server/moment-control.post'),
    })

    addCustomTab({
      name: 'devtools-login',
      title: 'Dev Tools',
      icon: 'carbon:tools',
      view: {
        type: 'iframe',
        src: '/__dev-login__/panel',
      },
    })
  },
})
