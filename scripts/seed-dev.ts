import { mkdir, writeFile, readdir, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { inArray } from 'drizzle-orm'
import * as schema from '../server/db/schema'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://collct:collct@localhost:5432/collct'
const BLOB_DIR = process.env.COLLCT_BLOB_DIR || '.data/blob'
const IMAGE_CACHE_DIR = join(__dirname, '..', 'dev', 'seed-images')
const IMAGE_COUNT = 12
const IMAGE_WIDTH = 800

const TEST_USERS = [
  { username: 'test1', email: 'test1@test.com', name: 'Test User 1' },
  { username: 'test2', email: 'test2@test.com', name: 'Test User 2' },
  { username: 'test3', email: 'test3@test.com', name: 'Test User 3' },
] as const

const TEST_GROUPS = [
  { name: 'All Friends', slug: 'all-friends', owner: 'test1', members: ['test1', 'test2', 'test3'] as const },
  { name: 'Close Friends', slug: 'close-friends', owner: 'test1', members: ['test1', 'test2'] as const },
  { name: 'Just Us', slug: 'just-us', owner: 'test2', members: ['test2', 'test3'] as const },
] as const

const PHOTO_ASSIGNMENTS = [
  { user: 'test1', group: 'all-friends', count: 4 },
  { user: 'test1', group: 'close-friends', count: 2 },
  { user: 'test2', group: 'all-friends', count: 3 },
  { user: 'test2', group: 'just-us', count: 2 },
  { user: 'test3', group: 'all-friends', count: 3 },
  { user: 'test3', group: 'just-us', count: 2 },
] as const

const CAPTIONS = [
  'Golden hour vibes',
  'Weekend adventures',
  'Coffee and good company',
  'City streets at dusk',
  'Nature always wins',
  'Simple pleasures',
  'Friends are the best medicine',
  'Chasing light',
  'Found this gem hidden away',
  'Sometimes you just have to stop and look around',
  'The little things matter most',
  'Another day, another memory',
  'Living for moments like these',
  'Home is where the wifi connects automatically',
  'Good food, better company',
  'This view never gets old',
]

const LIKES = [
  { user: 'test2', photoDesc: 'test1 in all-friends idx 0' },
  { user: 'test2', photoDesc: 'test1 in all-friends idx 2' },
  { user: 'test3', photoDesc: 'test1 in all-friends idx 1' },
  { user: 'test1', photoDesc: 'test2 in all-friends idx 0' },
  { user: 'test1', photoDesc: 'test2 in all-friends idx 1' },
  { user: 'test3', photoDesc: 'test2 in all-friends idx 2' },
  { user: 'test1', photoDesc: 'test3 in all-friends idx 0' },
  { user: 'test2', photoDesc: 'test3 in all-friends idx 1' },
]

const COMMENTS = [
  { user: 'test2', photoDesc: 'test1 in all-friends idx 0', body: 'This is amazing!' },
  { user: 'test3', photoDesc: 'test1 in all-friends idx 1', body: 'Love the lighting here' },
  { user: 'test1', photoDesc: 'test2 in all-friends idx 0', body: 'Great shot!' },
  { user: 'test3', photoDesc: 'test2 in just-us idx 0', body: 'We need to go back there' },
]

async function ensureImageCache(): Promise<string[]> {
  if (!existsSync(IMAGE_CACHE_DIR)) {
    await mkdir(IMAGE_CACHE_DIR, { recursive: true })
  }

  const existing = await readdir(IMAGE_CACHE_DIR)
  const jpgs = existing.filter(f => f.endsWith('.jpg')).sort()

  if (jpgs.length >= IMAGE_COUNT) {
    console.log(`  Using ${jpgs.length} cached images`)
    return jpgs.map(f => join(IMAGE_CACHE_DIR, f))
  }

  console.log(`  Fetching ${IMAGE_COUNT} images from picsum.photos...`)
  const paths: string[] = []

  for (let i = 1; i <= IMAGE_COUNT; i++) {
    const path = join(IMAGE_CACHE_DIR, `${String(i).padStart(2, '0')}.jpg`)
    if (existsSync(path)) {
      paths.push(path)
      continue
    }

    const url = `https://picsum.photos/${IMAGE_WIDTH}/${IMAGE_WIDTH}?random=${i}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch image ${i}: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    await writeFile(path, buffer)
    paths.push(path)
    console.log(`  Fetched image ${i}/${IMAGE_COUNT}`)
  }

  return paths
}

async function ensureBlobDir(): Promise<string> {
  const blobPhotosDir = join(BLOB_DIR, 'photos')
  if (!existsSync(blobPhotosDir)) {
    await mkdir(blobPhotosDir, { recursive: true })
  }
  return blobPhotosDir
}

async function main() {
  console.log('Seeding dev database...')
  console.log(`  Database: ${DATABASE_URL.replace(/:.+@/, ':***@')}`)
  console.log(`  Blob dir: ${BLOB_DIR}`)

  const client = postgres(DATABASE_URL)
  const db = drizzle(client, { schema })

  // 1. Fetch/cache images
  const imagePaths = await ensureImageCache()
  const blobPhotosDir = await ensureBlobDir()

  // 2. Look up existing test user IDs
  const existingUsers = await db
    .select({ id: schema.users.id, username: schema.users.username })
    .from(schema.users)
    .where(inArray(schema.users.username, [...TEST_USERS.map(u => u.username)]))

  const existingUserIds = existingUsers.map(u => u.id)

  if (existingUserIds.length > 0) {
    console.log(`  Wiping existing test data for ${existingUserIds.length} user(s)...`)

    // Delete in dependency order
    await db.delete(schema.commentReactions).where(
      inArray(schema.commentReactions.userId, existingUserIds)
    )
    await db.delete(schema.comments).where(
      inArray(schema.comments.userId, existingUserIds)
    )
    await db.delete(schema.likes).where(
      inArray(schema.likes.userId, existingUserIds)
    )

    // Delete photos (and their group associations) owned by test users
    const testPhotoIds = await db
      .select({ id: schema.photos.id })
      .from(schema.photos)
      .where(inArray(schema.photos.userId, existingUserIds))

    if (testPhotoIds.length > 0) {
      const photoIds = testPhotoIds.map(p => p.id)
      await db.delete(schema.photoGroups).where(
        inArray(schema.photoGroups.photoId, photoIds)
      )
      await db.delete(schema.notifications).where(
        inArray(schema.notifications.photoId, photoIds)
      )
      await db.delete(schema.photos).where(
        inArray(schema.photos.id, photoIds)
      )
    }

    await db.delete(schema.notifications).where(
      inArray(schema.notifications.userId, existingUserIds)
    )

    // Delete group memberships for test users
    await db.delete(schema.groupMembers).where(
      inArray(schema.groupMembers.userId, existingUserIds)
    )

    // Delete groups owned by test users
    await db.delete(schema.groups).where(
      inArray(schema.groups.ownerId, existingUserIds)
    )

    // Delete auth-related data
    await db.delete(schema.credentials).where(
      inArray(schema.credentials.userId, existingUserIds)
    )
    await db.delete(schema.totpSecrets).where(
      inArray(schema.totpSecrets.userId, existingUserIds)
    )
    await db.delete(schema.recoveryCodes).where(
      inArray(schema.recoveryCodes.userId, existingUserIds)
    )
    await db.delete(schema.pushSubscriptions).where(
      inArray(schema.pushSubscriptions.userId, existingUserIds)
    )
    await db.delete(schema.apiTokens).where(
      inArray(schema.apiTokens.userId, existingUserIds)
    )
    await db.delete(schema.pendingAuthorizations).where(
      inArray(schema.pendingAuthorizations.userId, existingUserIds)
    )

    // Finally delete users
    await db.delete(schema.users).where(
      inArray(schema.users.id, existingUserIds)
    )
  }

  // 3. Create test users
  console.log('  Creating test users...')
  const createdUsers: { id: number; username: string }[] = []

  for (const userData of TEST_USERS) {
    const [user] = await db
      .insert(schema.users)
      .values({
        username: userData.username,
        name: userData.name,
        email: userData.email,
        toursCompleted: '["oobe-v1"]',
      })
      .returning({ id: schema.users.id, username: schema.users.username })
    createdUsers.push(user!)
  }

  const userMap = new Map(createdUsers.map(u => [u.username, u.id]))

  // 4. Create groups
  console.log('  Creating groups...')
  const createdGroups: { id: number; slug: string }[] = []

  for (const groupData of TEST_GROUPS) {
    const [group] = await db
      .insert(schema.groups)
      .values({
        name: groupData.name,
        slug: groupData.slug,
        ownerId: userMap.get(groupData.owner)!,
        isPublic: false,
        momentsEnabled: true,
      })
      .returning({ id: schema.groups.id, slug: schema.groups.slug })
    createdGroups.push(group!)
  }

  const groupMap = new Map(createdGroups.map(g => [g.slug, g.id]))

  // 5. Create group memberships
  console.log('  Creating group memberships...')
  for (const groupData of TEST_GROUPS) {
    const groupId = groupMap.get(groupData.slug)!
    for (const memberUsername of groupData.members) {
      const userId = userMap.get(memberUsername)!
      const role = memberUsername === groupData.owner ? 'owner' : 'member'
      await db.insert(schema.groupMembers).values({
        groupId,
        userId,
        role,
      })
    }
  }

  // 6. Create photos
  console.log('  Creating photos...')
  const photosByUserGroup = new Map<string, { id: number }[]>()
  let imageIdx = 0

  for (const assignment of PHOTO_ASSIGNMENTS) {
    const userId = userMap.get(assignment.user)!
    const groupId = groupMap.get(assignment.group)!
    const photos: { id: number }[] = []

    for (let i = 0; i < assignment.count; i++) {
      const imgPath = imagePaths[imageIdx % imagePaths.length]
      const ext = 'jpg'
      const timestamp = Date.now() + i
      const blobPathname = `photos/${userId}/${timestamp}-${crypto.randomUUID().slice(0, 8)}.${ext}`

      // Copy image to blob directory
      const destPath = join(BLOB_DIR, blobPathname)
      const destDir = join(BLOB_DIR, `photos/${userId}`)
      if (!existsSync(destDir)) {
        await mkdir(destDir, { recursive: true })
      }
      await copyFile(imgPath, destPath)

      const captionIdx = (imageIdx + i) % CAPTIONS.length
      const [photo] = await db
        .insert(schema.photos)
        .values({
          userId,
          blobPathname,
          caption: CAPTIONS[captionIdx],
        })
        .returning({ id: schema.photos.id })

      await db.insert(schema.photoGroups).values({
        photoId: photo!.id,
        groupId,
      })

      photos.push(photo!)
      imageIdx++
    }

    photosByUserGroup.set(`${assignment.user}:${assignment.group}`, photos)
  }

  // 7. Create likes
  console.log('  Creating likes...')
  for (const like of LIKES) {
    const [userPart, groupPart, idxStr] = like.photoDesc.split(' in ')
    const idx = parseInt(idxStr!)
    const photos = photosByUserGroup.get(`${userPart}:${groupPart}`)
    const photo = photos?.[idx]
    if (photo) {
      await db.insert(schema.likes).values({
        userId: userMap.get(like.user)!,
        photoId: photo.id,
      }).catch(() => {}) // Ignore duplicate likes
    }
  }

  // 8. Create comments
  console.log('  Creating comments...')
  for (const comment of COMMENTS) {
    const [userPart, groupPart, idxStr] = comment.photoDesc.split(' in ')
    const idx = parseInt(idxStr!)
    const photos = photosByUserGroup.get(`${userPart}:${groupPart}`)
    const photo = photos?.[idx]
    if (photo) {
      await db.insert(schema.comments).values({
        userId: userMap.get(comment.user)!,
        photoId: photo.id,
        body: comment.body,
      })
    }
  }

  await client.end()

  console.log('\nDone! Created:')
  console.log(`  ${createdUsers.length} users`)
  console.log(`  ${createdGroups.length} groups`)
  console.log(`  ${imageIdx} photos`)
  console.log(`  ${LIKES.length} likes`)
  console.log(`  ${COMMENTS.length} comments`)
  console.log('\nYou can now use the DevTools login panel to log in as any test user.')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
