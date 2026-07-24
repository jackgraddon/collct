import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const startTime = Date.now()

export default defineEventHandler(() => {
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'))
  return {
    name: pkg.name,
    version: pkg.version ?? '0.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
  }
})
