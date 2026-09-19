/**
 * Verify clone: compare row counts between Neon and local.
 *
 * Usage:
 *   NEON_URL="..." LOCAL_URL="..." node scripts/verify-clone.mjs
 */

const NEON_URL = process.env.NEON_URL
const LOCAL_URL = process.env.LOCAL_URL

if (!NEON_URL || !LOCAL_URL) {
  console.error('Set NEON_URL and LOCAL_URL environment variables')
  process.exit(1)
}

const postgres = (await import('postgres')).default

const neon = postgres(NEON_URL, { max: 1 })
const local = postgres(LOCAL_URL, { max: 1 })

const tables = await neon.unsafe(`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`)

let match = 0
let mismatch = 0
let errors = 0

for (const { tablename } of tables) {
  try {
    const [neonRow] = await neon.unsafe(`SELECT COUNT(*)::int AS count FROM "${tablename}"`)
    const [localRow] = await local.unsafe(`SELECT COUNT(*)::int AS count FROM "${tablename}"`)

    if (neonRow.count === localRow.count) {
      match++
      console.log(`  ✓ ${tablename}: ${neonRow.count} rows`)
    } else {
      mismatch++
      console.log(`  ✗ ${tablename}: Neon=${neonRow.count}, Local=${localRow.count}`)
    }
  } catch (e) {
    errors++
    console.log(`  ⚠ ${tablename}: ${e.message}`)
  }
}

console.log(`\n${match} matched, ${mismatch} mismatched, ${errors} errors`)

await neon.end()
await local.end()
