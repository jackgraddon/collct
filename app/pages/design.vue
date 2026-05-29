<script setup lang="ts">
// DesignSystem.vue
// Navigation via UTabs, all content via Nuxt UI components + Tailwind utilities only.
// Colors reference the named type tokens (bubblegum-pink, onyx, etc.) mapped to
// Nuxt UI's primary/neutral/success/info/error via app.config.ts.

// ─── Color palette data ───────────────────────────────────────────────────────
const colorGroups = [
  {
    label: 'Bubblegum Pink',
    alias: 'primary',
    description: 'Brand identity — warm red-orange hues for CTAs, highlights, and interactive states.',
    swatches: [
      { step: 50,  value: 'oklch(94.81% 0.023 14.26)' },
      { step: 100, value: 'oklch(89.61% 0.046 14.73)' },
      { step: 200, value: 'oklch(79.66% 0.100 14.90)' },
      { step: 300, value: 'oklch(70.74% 0.154 17.89)' },
      { step: 400, value: 'oklch(63.64% 0.204 21.40)' },
      { step: 500, value: 'oklch(59.19% 0.232 26.32)' },
      { step: 600, value: 'oklch(50.26% 0.196 25.92)' },
      { step: 700, value: 'oklch(40.75% 0.156 25.65)' },
      { step: 800, value: 'oklch(30.87% 0.115 24.48)' },
      { step: 900, value: 'oklch(20% 0.067 22.58)'    },
      { step: 950, value: 'oklch(16.31% 0.053 19.61)' },
    ],
  },
  {
    label: 'Onyx',
    alias: 'neutral',
    description: 'Surface and structure — warm stone tones for backgrounds, borders, and text hierarchy.',
    swatches: [
      { step: 50,  value: 'oklch(96.36% 0.003 106.45)' },
      { step: 100, value: 'oklch(92.51% 0.003 84.56)'  },
      { step: 200, value: 'oklch(84.93% 0.008 80.72)'  },
      { step: 300, value: 'oklch(77.12% 0.011 81.79)'  },
      { step: 400, value: 'oklch(69.11% 0.014 82.40)'  },
      { step: 500, value: 'oklch(60.86% 0.018 82.78)'  },
      { step: 600, value: 'oklch(51.91% 0.015 82.38)'  },
      { step: 700, value: 'oklch(42.55% 0.012 81.76)'  },
      { step: 800, value: 'oklch(32.64% 0.010 80.67)'  },
      { step: 900, value: 'oklch(21.81% 0.004 84.59)'  },
      { step: 950, value: 'oklch(18.30% 0.003 67.66)'  },
    ],
  },
  {
    label: 'Jungle Teal',
    alias: 'success',
    description: 'Positive feedback — muted teal-greens for confirmations, completed states, and health indicators.',
    swatches: [
      { step: 50,  value: 'oklch(96.73% 0.008 177.33)' },
      { step: 100, value: 'oklch(93.22% 0.015 175.71)' },
      { step: 200, value: 'oklch(86.55% 0.032 176.46)' },
      { step: 300, value: 'oklch(79.67% 0.047 175.29)' },
      { step: 400, value: 'oklch(72.93% 0.064 173.55)' },
      { step: 500, value: 'oklch(66.03% 0.078 172.22)' },
      { step: 600, value: 'oklch(56.27% 0.066 172.31)' },
      { step: 700, value: 'oklch(45.85% 0.051 173.28)' },
      { step: 800, value: 'oklch(35.02% 0.037 173.94)' },
      { step: 900, value: 'oklch(22.99% 0.020 173.34)' },
      { step: 950, value: 'oklch(19.36% 0.016 173.98)' },
    ],
  },
  {
    label: 'Smart Blue',
    alias: 'info',
    description: 'Informational states — cool periwinkle blues for notices, tooltips, and neutral callouts.',
    swatches: [
      { step: 50,  value: 'oklch(95.76% 0.009 264.52)' },
      { step: 100, value: 'oklch(91.45% 0.016 262.75)' },
      { step: 200, value: 'oklch(82.94% 0.033 260.02)' },
      { step: 300, value: 'oklch(74.04% 0.053 260.41)' },
      { step: 400, value: 'oklch(65.23% 0.072 259.56)' },
      { step: 500, value: 'oklch(56.08% 0.093 259.92)' },
      { step: 600, value: 'oklch(47.99% 0.077 259.42)' },
      { step: 700, value: 'oklch(39.29% 0.062 260.10)' },
      { step: 800, value: 'oklch(30.36% 0.042 259.76)' },
      { step: 900, value: 'oklch(20.41% 0.024 262.26)' },
      { step: 950, value: 'oklch(17.29% 0.018 263.93)' },
    ],
  },
  {
    label: 'Bright Snow',
    alias: 'error',
    description: 'Destructive and warning states — desaturated terracotta reds for alerts, validation, and danger zones.',
    swatches: [
      { step: 50,  value: 'oklch(95.68% 0.006 17.27)' },
      { step: 100, value: 'oklch(91.40% 0.014 17.42)' },
      { step: 200, value: 'oklch(82.66% 0.030 17.77)' },
      { step: 300, value: 'oklch(73.80% 0.046 18.26)' },
      { step: 400, value: 'oklch(65.05% 0.064 18.93)' },
      { step: 500, value: 'oklch(55.92% 0.082 20)'    },
      { step: 600, value: 'oklch(47.90% 0.069 19.94)' },
      { step: 700, value: 'oklch(39.17% 0.056 19.88)' },
      { step: 800, value: 'oklch(30.16% 0.040 19.64)' },
      { step: 900, value: 'oklch(20.42% 0.022 19.11)' },
      { step: 950, value: 'oklch(17.14% 0.016 18.80)' },
    ],
  },
]

// ─── Typography scale ─────────────────────────────────────────────────────────
const typeRows = [
  { role: 'Display',    size: '3rem / 48px',    weight: '700', classes: 'text-5xl font-bold tracking-tight',         sample: 'The quick brown fox' },
  { role: 'Heading 1',  size: '2.25rem / 36px', weight: '700', classes: 'text-4xl font-bold',                        sample: 'Heading One' },
  { role: 'Heading 2',  size: '1.875rem / 30px',weight: '600', classes: 'text-3xl font-semibold',                    sample: 'Heading Two' },
  { role: 'Heading 3',  size: '1.5rem / 24px',  weight: '600', classes: 'text-2xl font-semibold',                    sample: 'Heading Three' },
  { role: 'Heading 4',  size: '1.25rem / 20px', weight: '500', classes: 'text-xl font-medium',                       sample: 'Heading Four' },
  { role: 'Body Large', size: '1.125rem / 18px',weight: '400', classes: 'text-lg',                                   sample: 'Body text at a larger reading size for introductions.' },
  { role: 'Body',       size: '1rem / 16px',    weight: '400', classes: 'text-base',                                 sample: 'Default body copy used for most prose and UI labels.' },
  { role: 'Small',      size: '0.875rem / 14px',weight: '400', classes: 'text-sm',                                   sample: 'Supporting text, captions, and secondary metadata.' },
  { role: 'XSmall',     size: '0.75rem / 12px', weight: '500', classes: 'text-xs font-medium tracking-wider uppercase', sample: 'Overline / Label' },
]

// ─── Token table rows ─────────────────────────────────────────────────────────
const tokenRows = [
  { token: '--color-bright-snow-*',    maps: 'primary',  usage: 'CTAs, interactive elements, brand highlights' },
  { token: '--color-onyx-*',           maps: 'neutral',  usage: 'Surfaces, borders, text hierarchy' },
  { token: '--color-jungle-teal-*',    maps: 'success',  usage: 'Confirmations, completed states' },
  { token: '--color-smart-blue-*',     maps: 'info',     usage: 'Notices, tooltips, neutral callouts' },
  { token: '--color-bubblegum-pink-*', maps: 'error',    usage: 'Alerts, validation errors, danger zones' },
  { token: '--font-sans',              maps: '—',        usage: "Figtree, system-ui — all body and UI text" },
]

// ─── UTabs items ─────────────────────────────────────────────────────────────
const tabs = [
  { label: 'Colors',      slot: 'colors',     icon: 'i-lucide-palette' },
  { label: 'Typography',  slot: 'typography', icon: 'i-lucide-type' },
  { label: 'Components',  slot: 'components', icon: 'i-lucide-layout-dashboard' },
  { label: 'Tokens',      slot: 'tokens',     icon: 'i-lucide-variable' },
]

// ─── Copy swatch var ─────────────────────────────────────────────────────────
const copied = ref<string | null>(null)
function copy(token: string) {
  navigator.clipboard.writeText(`var(${token})`)
  copied.value = token
  setTimeout(() => { copied.value = null }, 1500)
}
</script>

<template>
  <UContainer class="py-12 max-w-5xl">

    <!-- Header -->
    <div class="mb-10">
      <div class="flex items-center gap-3 mb-3">
        <UBadge color="primary" variant="subtle" size="sm">Design System</UBadge>
        <UBadge color="neutral" variant="subtle" size="sm">Nuxt UI v3</UBadge>
        <UBadge color="neutral" variant="subtle" size="sm">OKLCH</UBadge>
      </div>
      <h1 class="text-4xl font-bold tracking-tight mb-2">Design Tokens</h1>
      <p class="text-muted text-lg">
        Color, typography, and component documentation. All tokens map to Nuxt UI's semantic
        color system via <code class="text-primary">app.config.ts</code>.
      </p>
    </div>

    <USeparator class="mb-8" />

    <!-- Tabs -->
    <UTabs :items="tabs" variant="link" class="w-full">

      <!-- ── COLORS ──────────────────────────────────────────────────────── -->
      <template #colors>
        <div class="pt-8 space-y-10">
          <p class="text-muted text-sm max-w-2xl">
            All colors are defined in OKLCH — a perceptually uniform space ensuring consistent
            lightness steps. Each named scale maps to a Nuxt UI semantic alias via
            <code class="text-primary">app.config.ts</code>. Click any swatch to copy its variable.
          </p>

          <div v-for="group in colorGroups" :key="group.label" class="space-y-3">
            <div class="flex items-center gap-3">
              <h2 class="text-base font-semibold">{{ group.label }}</h2>
              <UBadge color="neutral" variant="outline" size="xs">
                {{ group.alias }}
              </UBadge>
            </div>
            <p class="text-muted text-sm">{{ group.description }}</p>

            <UCard :ui="{ body: 'p-0 sm:p-0' }">
              <div class="flex overflow-hidden rounded-lg">
                <button
                  v-for="swatch in group.swatches"
                  :key="swatch.step"
                  class="group flex-1 flex flex-col items-center gap-1 py-2 transition-all hover:flex-[1.5] cursor-pointer border-none bg-transparent"
                  :title="`--color-${group.label.toLowerCase().replace(' ', '-')}-${swatch.step}`"
                  @click="copy(`--color-${group.label.toLowerCase().replace(' ', '-')}-${swatch.step}`)"
                >
                  <span
                    class="block w-full"
                    style="aspect-ratio: 2/5"
                    :style="{ background: swatch.value }"
                  />
                  <span class="text-[10px] font-mono text-muted">{{ swatch.step }}</span>
                </button>
              </div>
            </UCard>
          </div>
        </div>
      </template>

      <!-- ── TYPOGRAPHY ──────────────────────────────────────────────────── -->
      <template #typography>
        <div class="pt-8 space-y-8">
          <p class="text-muted text-sm max-w-2xl">
            Built on <strong class="text-default">Figtree</strong> — a geometric sans-serif with
            rounded, warm details that pairs well with the earthy palette. Loaded via
            <code class="text-primary">--font-sans</code>.
          </p>

          <!-- Specimen card -->
          <UCard>
            <p class="text-2xl leading-relaxed text-muted tracking-wide">
              Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz
            </p>
            <p class="text-lg text-subtle mt-3 tracking-widest">
              0 1 2 3 4 5 6 7 8 9 &amp; ! ? @ # $ % ^
            </p>
          </UCard>

          <!-- Scale table -->
          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <UTable
              :data="typeRows"
              :columns="[
                { accessorKey: 'role',    header: 'Role',    meta: { class: { td: 'w-32' } } },
                { accessorKey: 'size',    header: 'Size',    meta: { class: { td: 'w-40' } } },
                { accessorKey: 'weight',  header: 'Weight',  meta: { class: { td: 'w-24' } } },
                { accessorKey: 'sample',  header: 'Sample' },
              ]"
            >
              <template #size-cell="{ row }">
                <code class="text-xs text-muted">{{ row.original.size }}</code>
              </template>
              <template #weight-cell="{ row }">
                <span class="text-muted text-sm">{{ row.original.weight }}</span>
              </template>
              <template #sample-cell="{ row }">
                <span :class="row.original.classes">{{ row.original.sample }}</span>
              </template>
            </UTable>
          </UCard>
        </div>
      </template>

      <!-- ── COMPONENTS ──────────────────────────────────────────────────── -->
      <template #components>
        <div class="pt-8 space-y-10">

          <!-- Buttons -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-sm">Buttons</span>
                <UBadge color="neutral" variant="outline" size="xs">UButton</UBadge>
              </div>
            </template>
            <div class="flex flex-wrap gap-3">
              <UButton color="primary" variant="solid">Primary</UButton>
              <UButton color="primary" variant="outline">Outline</UButton>
              <UButton color="primary" variant="soft">Soft</UButton>
              <UButton color="primary" variant="ghost">Ghost</UButton>
              <UButton color="neutral" variant="solid">Neutral</UButton>
              <UButton color="neutral" variant="outline">Neutral Outline</UButton>
              <UButton color="primary" variant="solid" size="sm">Small</UButton>
              <UButton color="primary" variant="solid" size="lg">Large</UButton>
              <UButton color="primary" variant="solid" loading>Loading</UButton>
              <UButton color="primary" variant="solid" disabled>Disabled</UButton>
            </div>
          </UCard>

          <!-- Badges -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-sm">Badges</span>
                <UBadge color="neutral" variant="outline" size="xs">UBadge</UBadge>
              </div>
            </template>
            <div class="flex flex-wrap gap-3">
              <UBadge color="primary" variant="solid">Primary</UBadge>
              <UBadge color="primary" variant="soft">Soft</UBadge>
              <UBadge color="primary" variant="outline">Outline</UBadge>
              <UBadge color="primary" variant="subtle">Subtle</UBadge>
              <UBadge color="neutral" variant="solid">Neutral</UBadge>
              <UBadge color="success" variant="solid">Success</UBadge>
              <UBadge color="info" variant="solid">Info</UBadge>
              <UBadge color="error" variant="solid">Error</UBadge>
            </div>
          </UCard>

          <!-- Alerts -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-sm">Alerts</span>
                <UBadge color="neutral" variant="outline" size="xs">UAlert</UBadge>
              </div>
            </template>
            <div class="space-y-3">
              <UAlert
                color="success" variant="soft"
                title="Changes saved"
                description="Your project settings have been updated successfully."
                icon="i-lucide-circle-check"
              />
              <UAlert
                color="info" variant="soft"
                title="Build queued"
                description="A new deployment has been queued and will go live shortly."
                icon="i-lucide-info"
              />
              <UAlert
                color="error" variant="soft"
                title="Validation failed"
                description="One or more fields contain errors. Please review and try again."
                icon="i-lucide-triangle-alert"
              />
              <UAlert
                color="primary" variant="soft"
                title="New feature available"
                description="Live preview mode is now available in all projects."
                icon="i-lucide-sparkles"
              />
            </div>
          </UCard>

          <!-- Inputs -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-sm">Inputs</span>
                <UBadge color="neutral" variant="outline" size="xs">UInput</UBadge>
                <UBadge color="neutral" variant="outline" size="xs">USelect</UBadge>
                <UBadge color="neutral" variant="outline" size="xs">UTextarea</UBadge>
              </div>
            </template>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <UInput placeholder="Search components…" icon="i-lucide-search" />
              <UInput color="primary" placeholder="Focused state" />
              <UInput placeholder="Disabled input" disabled />
              <USelect
                :items="['Figtree', 'Inter', 'Geist', 'Satoshi']"
                placeholder="Select a font…"
              />
              <UTextarea placeholder="Leave a comment…" :rows="3" class="sm:col-span-2" />
            </div>
          </UCard>

          <!-- Toggles & Avatars -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm">Switches</span>
                  <UBadge color="neutral" variant="outline" size="xs">USwitch</UBadge>
                </div>
              </template>
              <div class="space-y-3">
                <USwitch default-value label="Dark mode" />
                <USwitch default-value color="success" label="Live sync" />
                <USwitch color="error" label="Danger zone" />
                <USwitch disabled label="Disabled" />
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm">Avatars</span>
                  <UBadge color="neutral" variant="outline" size="xs">UAvatar</UBadge>
                </div>
              </template>
              <div class="flex items-center gap-4 flex-wrap">
                <UAvatar text="JG" size="sm" />
                <UAvatar text="JG" />
                <UAvatar text="JG" size="lg" />
                <UAvatar text="JG" size="xl" />
                <UAvatarGroup>
                  <UAvatar text="JG" />
                  <UAvatar text="AB" />
                  <UAvatar text="MK" />
                  <UAvatar text="+3" />
                </UAvatarGroup>
              </div>
            </UCard>
          </div>

          <!-- Progress & Skeleton -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm">Progress</span>
                  <UBadge color="neutral" variant="outline" size="xs">UProgress</UBadge>
                </div>
              </template>
              <div class="space-y-4">
                <UProgress :value="72" color="primary" />
                <UProgress :value="45" color="success" />
                <UProgress :value="88" color="info" />
                <UProgress indeterminate color="primary" />
              </div>
            </UCard>

            <UCard>
              <template #header>
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm">Skeleton</span>
                  <UBadge color="neutral" variant="outline" size="xs">USkeleton</UBadge>
                </div>
              </template>
              <div class="space-y-4">
                <div class="flex items-center gap-3">
                  <USkeleton class="w-10 h-10 rounded-full shrink-0" />
                  <div class="flex flex-col gap-2 flex-1">
                    <USkeleton class="h-3 w-3/4 rounded" />
                    <USkeleton class="h-3 w-1/2 rounded" />
                  </div>
                </div>
                <USkeleton class="h-20 w-full rounded-lg" />
              </div>
            </UCard>
          </div>

          <!-- Kbd & Tooltip -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <span class="font-semibold text-sm">Kbd &amp; Tooltip</span>
                <UBadge color="neutral" variant="outline" size="xs">UKbd</UBadge>
                <UBadge color="neutral" variant="outline" size="xs">UTooltip</UBadge>
              </div>
            </template>
            <div class="flex flex-wrap gap-4 items-center">
              <div class="flex items-center gap-1">
                <UKbd>⌘</UKbd><UKbd>K</UKbd>
              </div>
              <div class="flex items-center gap-1">
                <UKbd>Ctrl</UKbd><UKbd>Shift</UKbd><UKbd>P</UKbd>
              </div>
              <UTooltip text="This is a tooltip">
                <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-info">
                  Hover me
                </UButton>
              </UTooltip>
            </div>
          </UCard>

        </div>
      </template>

      <!-- ── TOKENS ───────────────────────────────────────────────────────── -->
      <template #tokens>
        <div class="pt-8 space-y-8">
          <p class="text-muted text-sm max-w-2xl">
            Named type tokens from <code class="text-primary">colors.types.css</code> are mapped to
            Nuxt UI's semantic color system in <code class="text-primary">app.config.ts</code>.
            No intermediate alias file needed.
          </p>

          <!-- app.config snippet -->
          <UCard>
            <template #header>
              <span class="font-semibold text-sm font-mono">app.config.ts</span>
            </template>
            <pre class="text-sm leading-relaxed overflow-x-auto"><code><span class="text-muted">export default</span> defineAppConfig({
  ui: {
    colors: {
      primary: <span class="text-primary">'bright-snow'</span>,
      neutral: <span class="text-neutral">'onyx'</span>,
      success: <span class="text-success">'jungle-teal'</span>,
      info:    <span class="text-info">'smart-blue'</span>,
      error:   <span class="text-error">'bubblegum-pink'</span>,
    }
  }
})</code></pre>
          </UCard>

          <!-- Token table -->
          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <UTable
              :data="tokenRows"
              :columns="[
                { accessorKey: 'token',  header: 'Token' },
                { accessorKey: 'maps',   header: 'UI Alias', meta: { class: { td: 'w-32' } } },
                { accessorKey: 'usage',  header: 'Usage' },
              ]"
            >
              <template #token-cell="{ row }">
                <code class="text-xs text-primary">{{ row.original.token }}</code>
              </template>
              <template #maps-cell="{ row }">
                <UBadge
                  v-if="row.original.maps !== '—'"
                  :color="row.original.maps === 'primary' ? 'primary'
                        : row.original.maps === 'neutral'  ? 'neutral'
                        : row.original.maps === 'success'  ? 'success'
                        : row.original.maps === 'info'     ? 'info'
                        : 'error'"
                  variant="soft"
                  size="xs"
                >{{ row.original.maps }}</UBadge>
                <span v-else class="text-muted">—</span>
              </template>
              <template #usage-cell="{ row }">
                <span class="text-muted text-sm">{{ row.original.usage }}</span>
              </template>
            </UTable>
          </UCard>

          <!-- OKLCH callout -->
          <UAlert
            color="info"
            variant="soft"
            icon="i-lucide-info"
            title="Why OKLCH?"
            description="OKLCH produces perceptually uniform lightness steps — each numeric step looks equally different to the human eye. This eliminates the muddiness you get from HSL-based scales at high saturation, and makes WCAG contrast ratios predictable without a separate checker."
          />
        </div>
      </template>

    </UTabs>
  </UContainer>
</template>