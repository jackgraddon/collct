<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-2">Cache Audit</h1>
    <p class="text-neutral-500 mb-6">Diagnoses why images are being re-fetched on every page load.</p>

    <UButton
      :disabled="isRunning"
      :loading="isRunning"
      label="Run Audit"
      @click="run"
    />

    <div v-if="report" class="mt-8 space-y-8">
      <!-- Severity badge -->
      <div class="flex items-center gap-3">
        <span
          :class="{
            'bg-green-100 text-green-800': report.severity === 'OK',
            'bg-yellow-100 text-yellow-800': report.severity === 'WARNING',
            'bg-red-100 text-red-800': report.severity === 'CRITICAL',
          }"
          class="px-3 py-1 rounded-full text-sm font-medium"
        >
          {{ report.severity }}
        </span>
        <span class="text-sm text-neutral-500">{{ report.allIssues.length }} issue(s) found</span>
      </div>

      <!-- All issues -->
      <section v-if="report.allIssues.length > 0">
        <h2 class="text-lg font-semibold mb-3">Issues</h2>
        <ul class="space-y-2">
          <li
            v-for="(issue, i) in report.allIssues"
            :key="i"
            :class="{
              'border-l-red-500 bg-red-50': issue.severity === 'error',
              'border-l-yellow-500 bg-yellow-50': issue.severity === 'warning',
              'border-l-blue-500 bg-blue-50': issue.severity === 'info',
            }"
            class="border-l-4 px-4 py-2 rounded-r text-sm"
          >
            <span class="font-mono text-xs text-neutral-400">[{{ issue.phase }}]</span>
            {{ issue.message }}
          </li>
        </ul>
      </section>

      <!-- Phase 1: HTTP Headers -->
      <section>
        <h2 class="text-lg font-semibold mb-3">HTTP Headers</h2>
        <p class="text-sm text-neutral-500 mb-2">First image: {{ report.phases.headers.url }}</p>
        <div class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4 font-mono text-xs space-y-1">
          <div v-for="(val, key) in report.phases.headers.headers" :key="key">
            <span class="text-neutral-400">{{ key }}:</span>
            <span :class="val ? '' : 'text-red-500'">{{ val || '(missing)' }}</span>
          </div>
        </div>
      </section>

      <!-- Phase 2: Browser Cache -->
      <section>
        <h2 class="text-lg font-semibold mb-3">Browser Cache</h2>
        <p class="text-sm text-neutral-500 mb-2">
          Hit rate: {{ Math.round(report.phases.browserCache.cacheHitRate * 100) }}%
        </p>
        <div v-if="report.phases.browserCache.timings.length > 0" class="space-y-2">
          <div
            v-for="t in report.phases.browserCache.timings"
            :key="t.url"
            class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3 text-xs"
          >
            <div class="flex items-center gap-2 mb-1">
              <span
                :class="t.cached ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
                class="px-2 py-0.5 rounded text-xs font-medium"
              >
                {{ t.cached ? 'CACHED' : 'MISS' }}
              </span>
              <span class="text-neutral-500 truncate">{{ t.url }}</span>
            </div>
            <div class="flex gap-4 text-neutral-500">
              <span>1st: {{ t.firstLoadMs }}ms</span>
              <span>2nd: {{ t.secondLoadMs }}ms</span>
              <span>{{ t.speedup }}x speedup</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Phase 3: SW Cache -->
      <section>
        <h2 class="text-lg font-semibold mb-3">Service Worker Cache Storage</h2>
        <p class="text-sm text-neutral-500 mb-2">
          {{ report.phases.swCache.totalCachedImages }} image(s) cached across
          {{ report.phases.swCache.caches.length }} cache(s)
        </p>
        <div v-if="report.phases.swCache.caches.length > 0" class="space-y-2">
          <div
            v-for="c in report.phases.swCache.caches"
            :key="c.cacheName"
            class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-3 text-xs"
          >
            <div class="font-medium">{{ c.cacheName }}</div>
            <div class="text-neutral-500">
              {{ c.imageRequests }} images / {{ c.totalRequests }} total entries
            </div>
            <div v-if="c.urls.length > 0" class="mt-1 text-neutral-400 truncate">
              Sample: {{ c.urls[0] }}
            </div>
          </div>
        </div>
      </section>

      <!-- Phase 4: Network -->
      <section>
        <h2 class="text-lg font-semibold mb-3">Network Activity (10s observation)</h2>
        <p class="text-sm text-neutral-500 mb-2">
          {{ report.phases.network.totalFetches }} fetches, {{ report.phases.network.uniqueImages }} unique images
        </p>
        <div v-if="report.phases.network.duplicates.length > 0" class="space-y-1">
          <div
            v-for="d in report.phases.network.duplicates"
            :key="d.url"
            class="bg-red-50 dark:bg-red-950 rounded p-2 text-xs text-red-700 dark:text-red-300"
          >
            {{ d.url }} — fetched {{ d.count }}x
          </div>
        </div>
      </section>

      <!-- Phase 5: Server Config -->
      <section>
        <h2 class="text-lg font-semibold mb-3">Server Configuration</h2>
        <p class="text-sm text-neutral-500 mb-2">URL: {{ report.phases.serverConfig.url }}</p>
        <div class="bg-neutral-50 dark:bg-neutral-900 rounded-lg p-4 font-mono text-xs space-y-1">
          <div v-for="(val, key) in report.phases.serverConfig.headers" :key="key">
            <span class="text-neutral-400">{{ key }}:</span>
            <span :class="val ? '' : 'text-red-500'">{{ val || '(missing)' }}</span>
          </div>
        </div>
      </section>

      <!-- Export -->
      <div class="flex gap-3 pt-4 border-t">
        <UButton label="Download JSON" variant="outline" @click="download" />
        <UButton label="Copy to clipboard" variant="outline" @click="copy" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { runCachingAudit } from '~/utils/cacheAudit'

definePageMeta({ middleware: 'auth' })

const report = ref<Awaited<ReturnType<typeof runCachingAudit>> | null>(null)
const isRunning = ref(false)

async function run() {
  isRunning.value = true
  report.value = await runCachingAudit()
  isRunning.value = false
}

function download() {
  if (!report.value) return
  const blob = new Blob([JSON.stringify(report.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cache-audit-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function copy() {
  if (!report.value) return
  await navigator.clipboard.writeText(JSON.stringify(report.value, null, 2))
}
</script>
