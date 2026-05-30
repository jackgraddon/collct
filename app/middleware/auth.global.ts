export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/']

  if (!loggedIn.value && !publicRoutes.includes(to.path)) {
    return navigateTo('/login')
  }

  // Prevent authenticated users from accessing login/register pages
  if (loggedIn.value && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/feed')
  }
})