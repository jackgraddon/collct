import { fetch } from 'node-fetch-native'

async function runTests() {
  const baseUrl = 'http://localhost:3000'
  let cookie = ''
  const email = `test-${Date.now()}@example.com`
  const password = 'password123'

  console.log('--- Starting API Verification ---')

  // 1. Register a new user
  console.log('Testing Registration...')
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test User',
      email: email,
      password: password
    }),
    headers: { 'Content-Type': 'application/json' }
  })

  if (regRes.status !== 200) {
    const error = await regRes.text()
    console.error(`Registration failed: ${regRes.status} ${error}`)
    process.exit(1)
  }
  console.log('Registration successful!')
  cookie = regRes.headers.get('set-cookie') || ''

  // 2. Login
  console.log('Testing Login...')
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: email,
      password: password
    }),
    headers: { 'Content-Type': 'application/json' }
  })

  if (loginRes.status !== 200) {
    const error = await loginRes.text()
    console.error(`Login failed: ${loginRes.status} ${error}`)
    process.exit(1)
  }
  console.log('Login successful!')
  cookie = loginRes.headers.get('set-cookie') || cookie

  // 3. Get Photos (via a protected route)
  console.log('Testing Protected Route (photos/index)...')
  const photosRes = await fetch(`${baseUrl}/api/photos`, {
    headers: { 'Cookie': cookie }
  })

  if (photosRes.status !== 200) {
    const error = await photosRes.text()
    console.error(`Fetching photos failed: ${photosRes.status} ${error}`)
    process.exit(1)
  }
  console.log('Protected route access successful!')

  console.log('--- All tests passed! ---')
  process.exit(0)
}

runTests().catch(err => {
  console.error(err)
  process.exit(1)
})
