export default defineEventHandler(async (event) => {
  // Clears the encrypted cookie session entirely
  await clearUserSession(event)
  
  return { 
    success: true,
    message: 'Logged out successfully' 
  }
})