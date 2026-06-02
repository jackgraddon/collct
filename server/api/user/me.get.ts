import { presignUrl } from '@vercel/blob'

export default defineEventHandler(async (event) => {
  // Ensure the user is logged in
  const session = await requireUserSession(event)
  
  const user = session.user
  let signedAvatarUrl = null

  // If the user has an avatar, generate a fresh 1-hour signed URL
  if (user.avatarPathname) {
    const token = await getDelegationToken()
    
    signedAvatarUrl = presignUrl(token, {
      pathname: user.avatarPathname,
      operation: 'get',
      access: 'private',
      validUntil: Date.now() + 60 * 60 * 1000
    })
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: signedAvatarUrl
  }
})