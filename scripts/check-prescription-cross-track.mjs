import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Real dashboard UI with synthetic consultations. All API writes are blocked.
const cwd = fileURLToPath(new URL('../', import.meta.url))
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const origin = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd,
  env: { ...process.env, VITE_SKIP_CLERK: '1', VITE_LOCAL_PREVIEW_DATA: 'false', VITE_API_BASE: '/api', VITE_API_PROXY_TARGET: 'http://127.0.0.1:1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverOutput = ''
server.stdout.on('data', chunk => { serverOutput += chunk })
server.stderr.on('data', chunk => { serverOutput += chunk })
let browser

function appointment(track, source) {
  return {
    id: `consult_${track}`, source, quickwlp_lead_id: source === 'quickwlp' ? `lead_${track}` : undefined,
    patient_id: `patient_${track}`, time: '14:00', date: '2026-09-29',
    duration_minutes: 15, service_name: 'Quick Consult', visit_type: 'video',
    status: 'completed', track_key: track, doctor_id: 'doctor_sami_dev',
    scheduled_start_at: '2026-09-29T14:00:00+04:00',
    patient: { id: `patient_${track}`, name: `Test ${track}`, phone: '+971500000000', customer_id: `customer_${track}` },
    workbench: { consultation: { outcome: 'PRESCRIPTION_NEEDED' } },
  }
}
function product(id, category, name) {
  return { product_id: id, vertical_id: 'shipments', name, price_fils: 10000, active: true, attributes_json: { category } }
}

try {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (server.exitCode !== null) throw new Error(serverOutput)
    if (await fetch(origin).then(response => response.ok).catch(() => false)) break
    if (attempt === 199) throw new Error(`Local test server did not start: ${serverOutput}`)
    await delay(25)
  }
  browser = await chromium.launch({ channel: 'chromium' })
  for (const source of ['quickwlp', 'rx']) for (const track of ['weight-loss', 'peptides']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const writes = []
    const errors = []
    const catalogRequests = []
    page.on('pageerror', error => errors.push(error.message))
    await context.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin !== origin) return route.abort()
      if (!url.pathname.startsWith('/api/')) return route.continue()
      if (request.method() !== 'GET') {
        writes.push(`${request.method()} ${url.pathname}`)
        return route.abort()
      }
      if (url.pathname.endsWith('/dashboard/appointments')) return route.fulfill({ json: { today: [appointment(track, source)], week: [] } })
      if (url.pathname.endsWith('/demographics')) return route.fulfill({ json: { patient: { patient_id: `patient_${track}`, name: `Test ${track}`, date_of_birth: '1990-01-01', gender: 'male', missing_fields: [] } } })
      if (url.pathname.endsWith('/rx/prescribable-patients')) return route.fulfill({ json: { patients: [] } })
      if (url.pathname.endsWith('/quickwlp/products')) {
        const catalog = url.searchParams.get('catalog')
        catalogRequests.push(catalog)
        const products = catalog === 'weight-loss'
          ? [product('shared', 'MEDICATION', 'Shared medication'), product('weight', 'WEIGHT_LOSS', 'Weight medicine')]
          : [product('shared', 'MEDICATION', 'Shared medication'), product('peptide', 'PEPTIDE', 'Peptide medicine')]
        return route.fulfill({ json: { products } })
      }
      if (url.pathname.includes('/rx/tracks/') && url.pathname.endsWith('/prescribable-products')) {
        catalogRequests.push(url.pathname)
        return route.fulfill({ json: { products: [product('shared', 'MEDICATION', 'Shared medication'), product('weight', 'WEIGHT_LOSS', 'Weight medicine'), product('peptide', 'PEPTIDE', 'Peptide medicine')] } })
      }
      return route.fulfill({ json: { patients: [], tasks: [], metrics: {} } })
    })
    await page.goto(`${origin}/?account_id=mp_sami`)
    await page.getByRole('button', { name: 'Issue prescription', exact: true }).click()
    const otherTrack = track === 'weight-loss' ? 'Peptides' : 'Weight loss'
    const otherCatalog = track === 'weight-loss' ? 'peptides' : 'weight-loss'
    const sharedRow = page.locator('.rx-product-row').filter({ hasText: 'Shared medication' })
    await sharedRow.getByRole('button', { name: 'Add', exact: true }).click()
    const tab = page.locator('.rx-product-source-tabs button').filter({ hasText: otherTrack })
    await tab.waitFor()
    assert.equal(await tab.isEnabled(), true, `${otherTrack} tab must be available during ${track} consult`)
    await tab.click()
    await page.getByText(otherCatalog === 'peptides' ? 'Peptide medicine' : 'Weight medicine', { exact: true }).waitFor()
    assert.equal(await sharedRow.getByRole('button', { name: 'Add', exact: true }).count(), 0, 'Shared product must not be added twice across catalogs')
    assert.equal((await sharedRow.locator('.rx-product-qty').textContent()).trim(), '1')
    assert.ok(source === 'quickwlp'
      ? catalogRequests.includes(otherCatalog)
      : catalogRequests.includes(`/api/doctor/rx/tracks/${track}/prescribable-products`),
    `Expected ${source} catalog request for ${track}`)
    assert.deepEqual(writes, [], 'No prescription or other API writes in smoke test')
    assert.deepEqual(errors, [], 'No browser errors')
    await context.close()
  }
  console.log('PASS: QuickWLP and Rx consultations can select the opposite medication catalog without changing the consultation track or making API writes')
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
