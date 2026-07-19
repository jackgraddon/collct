export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/auth/device', '/auth/authorize']

  // If not logged in and trying to access a protected route (including /)
  if (!loggedIn.value && !publicRoutes.includes(to.path)) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  // Prevent authenticated users from accessing login/register pages
  if (loggedIn.value && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/')
  }
})
