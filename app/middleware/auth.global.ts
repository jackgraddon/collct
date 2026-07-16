export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, session } = useUserSession()

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/']

  // If not logged in and trying to access a protected route
  if (!loggedIn.value && !publicRoutes.includes(to.path)) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  // If in a pending MFA state, force them to stay on the login page (which should show the MFA challenge)
  // or redirect them if they try to go elsewhere.
  // Note: Since 'loggedIn' is true if 'user' exists, our new system ensures 'loggedIn' is false during MFA challenge.
  // So the first check above handles it.

  // Prevent authenticated users from accessing login/register pages
  if (loggedIn.value && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/feed')
  }
})
