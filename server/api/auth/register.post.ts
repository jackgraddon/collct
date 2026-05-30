import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const { name, email, password } = await readBody(event)

  const existingUser = await db.select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get()

  if (existingUser) {
    throw createError({ statusCode: 409, statusMessage: 'Email already in use' })
  }

  const hashedPassword = await hashPassword(password)

  const [newUser] = await db.insert(schema.users).values({
    name,
    email,
    password: hashedPassword,
  }).returning()

  await setUserSession(event, {
    user: {
      id: newUser?.id,
      email: newUser?.email,
      name: newUser?.name,
    }
  })

  return { success: true }
})