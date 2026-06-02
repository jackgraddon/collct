import { presignUrl } from '@vercel/blob'

export default defineEventHandler(async (event) => {
  // Ensure the user is logged in
  const session = await requireUserSession(event)
  const token = await getDelegationToken()
  
  const user = session.user
  let signedAvatarUrl = null

  // If the user has an avatar, generate a fresh 1-hour signed URL
  if (user.avatarPathname) {
    const token = await getDelegationToken()
    
    const { presignedUrl } = await presignUrl(token, {
      pathname: user.avatarUrl, // This is the key 'avatars/1-123.jpg'
      access: 'private',
      operation: 'get',
      validUntil: Date.now() + 60 * 60 * 1000
    })
    signedAvatarUrl = presignedUrl
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: signedAvatarUrl
  }
})