/**
 * Clone database from Neon to a target Postgres.
 *
 * Usage:
 *   NEON_URL="..." LOCAL_URL="..." node scripts/clone-db.mjs
 *
 * Creates schema from Neon, then copies all data.
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

// ── Step 1: Dump schema from Neon ──────────────────────────────────────────
console.log('📋 Dumping schema from Neon...')

const tables = await neon.unsafe(`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`)

const sequences = await neon.unsafe(`
  SELECT sequencename FROM pg_sequences
  WHERE schemaname = 'public'
  ORDER BY sequencename
`)

const indexes = await neon.unsafe(`
  SELECT indexname, indexdef FROM pg_indexes
  WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey'
  ORDER BY indexname
`)

const customTypes = await neon.unsafe(`
  SELECT t.typname, e.enumlabel
  FROM pg_type t
  JOIN pg_enum e ON t.oid = e.enumtypid
  JOIN pg_namespace n ON t.typnamespace = n.oid
  WHERE n.nspname = 'public'
  ORDER BY t.typname, e.enumsortorder
`)

// Group enum values by type name
const enumTypes = {}
for (const { typname, enumlabel } of customTypes) {
  if (!enumTypes[typname]) enumTypes[typname] = []
  enumTypes[typname].push(enumlabel)
}

// ── Step 2: Create schema on local ─────────────────────────────────────────
console.log('🔨 Creating schema on local database...')

// Create custom types first (tables reference them)
for (const [typeName, values] of Object.entries(enumTypes)) {
  try {
    await local.unsafe(`DROP TYPE IF EXISTS "${typeName}" CASCADE`)
    const valueList = values.map(v => `'${v}'`).join(', ')
    await local.unsafe(`CREATE TYPE "${typeName}" AS ENUM (${valueList})`)
    console.log(`  type "${typeName}" ✓`)
  } catch (e) {
    console.warn(`  ⚠ Type ${typeName}: ${e.message}`)
  }
}

// Create sequences (tables reference them via DEFAULT nextval)
for (const { sequencename } of sequences) {
  try {
    await local.unsafe(`DROP SEQUENCE IF EXISTS "${sequencename}" CASCADE`)
    await local.unsafe(`CREATE SEQUENCE "${sequencename}"`)
  } catch {
    // Sequence may already exist as part of a serial column
  }
}

for (const { tablename } of tables) {
  // Get column definitions from Neon
  const cols = await neon.unsafe(`
    SELECT column_name, data_type, is_nullable, column_default,
           udt_name, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '${tablename}'
    ORDER BY ordinal_position
  `)

  const colDefs = cols.map(c => {
    let type = c.data_type
    if (c.data_type === 'USER-DEFINED') type = c.udt_name
    if (c.character_maximum_length) type += `(${c.character_maximum_length})`
    const nullable = c.is_nullable === 'YES' ? '' : ' NOT NULL'
    const def = c.column_default ? ` DEFAULT ${c.column_default}` : ''
    return `  "${c.column_name}" ${type}${nullable}${def}`
  }).join(',\n')

  await local.unsafe(`DROP TABLE IF EXISTS "${tablename}" CASCADE`)
  await local.unsafe(`CREATE TABLE "${tablename}" (\n${colDefs}\n)`)
}

// Create indexes
for (const { indexname, indexdef } of indexes) {
  try {
    await local.unsafe(`DROP INDEX IF EXISTS "${indexname}"`)
    await local.unsafe(indexdef)
  } catch (e) {
    console.warn(`  ⚠ Index ${indexname}: ${e.message}`)
  }
}

console.log(`  Schema created: ${tables.length} tables, ${sequences.length} sequences, ${indexes.length} indexes`)

// ── Step 3: Copy data ──────────────────────────────────────────────────────
console.log('\n📦 Copying data...')

let totalRows = 0

for (const { tablename } of tables) {
  const [{ count }] = await neon.unsafe(`SELECT COUNT(*)::int AS count FROM "${tablename}"`)

  if (count === 0) {
    console.log(`  ${tablename}: 0 rows (skipped)`)
    continue
  }

  const rows = await neon.unsafe(`SELECT * FROM "${tablename}"`)
  if (rows.length === 0) continue

  const columns = Object.keys(rows[0])

  const batchSize = 500
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const values = batch.map(row => {
      const vals = columns.map(col => {
        const val = row[col]
        if (val === null || val === undefined) return 'NULL'
        if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
        if (typeof val === 'number') return val
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
        if (val instanceof Date) return `'${val.toISOString()}'`
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
        return `'${String(val).replace(/'/g, "''")}'`
      }).join(', ')
      return `(${vals})`
    }).join(', ')

    await local.unsafe(
      `INSERT INTO "${tablename}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES ${values}`
    )
  }

  totalRows += rows.length
  console.log(`  ${tablename}: ${rows.length} rows ✓`)
}

// ── Step 4: Reset sequences ────────────────────────────────────────────────
console.log('\n🔄 Resetting sequences...')

for (const { sequencename } of sequences) {
  try {
    const [{ max }] = await local.unsafe(`
      SELECT COALESCE(last_value, 0)::bigint AS max FROM "${sequencename}"
    `)
    await local.unsafe(`SELECT setval('${sequencename}', ${max + 1})`)
    console.log(`  ${sequencename} → ${max + 1}`)
  } catch (e) {
    console.warn(`  ⚠ Sequence ${sequencename}: ${e.message}`)
  }
}

console.log(`\nDone! ${totalRows} total rows cloned.`)

await neon.end()
await local.end()
