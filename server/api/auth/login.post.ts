import { eq } from 'drizzle-orm'
import { db, schema } from '@nuxthub/db'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  const userRecord = await db.select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get()

  if (!userRecord || !(await verifyPassword(password, userRecord.password))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  await setUserSession(event, {
    user: {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
    }
  })

  return { success: true }
})
