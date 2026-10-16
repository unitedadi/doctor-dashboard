import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Once an appointment has started, the doctor marks a member who did not join as a no-show; Cancel is only offered before.
// Real React UI, synthetic patients, mocked reads only. Never calls the live API.
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
async function until(check, label) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await check()) return
    await delay(25)
  }
  throw new Error(`Timed out: ${label}`)
}
function appointment(id, name, time, date, doctorId, source) {
  return {
    id, source, patient_id: `patient_${id}`, quickwlp_lead_id: `lead_${id}`,
    time, date, duration_minutes: 15, service_name: 'Quick Consult', visit_type: 'phone',
    status: 'upcoming', track_key: 'weight-loss', doctor_id: doctorId,
    scheduled_start_at: `${date}T${time}:00+04:00`, scheduled_end_at: `${date}T${time.slice(0, 3)}15:00+04:00`,
    patient: { id: `patient_${id}`, name, initials: name[0], phone: '+971500000000' },
  }
}
try {
  await until(async () => {
    if (server.exitCode !== null) throw new Error(serverOutput)
    return fetch(origin).then(r => r.ok).catch(() => false)
  }, 'local test server')
  browser = await chromium.launch({ channel: 'chromium' })
  for (const source of ['quickwlp', 'rx']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const errors = []
    const writes = []
    page.on('pageerror', error => errors.push(error.message))
    // 15:30 Dubai: the 15:00 appointment has started, the 16:00 one has not.
    await page.clock.install({ time: new Date('2026-09-24T11:30:00Z') })
    await page.clock.pauseAt(new Date('2026-09-24T11:30:00Z'))
    await context.route('**/*', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.origin !== origin) return route.abort()
      if (!url.pathname.startsWith('/api/')) return route.continue()
      if (request.method() !== 'GET') {
        writes.push(`${request.method()} ${url.pathname}`)
        return route.abort()
      }
      if (url.pathname.endsWith('/dashboard/appointments')) {
        const date = url.searchParams.get('date')
        return route.fulfill({ json: { today: [
          appointment('started', 'Started Patient', '15:00', date, 'doctor_sami_dev', source),
          appointment('upcoming', 'Upcoming Patient', '16:00', date, 'doctor_sami_dev', source),
        ], week: [] } }).catch(() => {})
      }
      return route.fulfill({ json: { patients: [], tasks: [], metrics: {} } })
    })
    const button = name => page.getByRole('button', { name, exact: true })
    const choose = async name => {
      await page.locator('.apt-card').filter({ hasText: name }).click()
      await until(async () => (await page.locator('.workbench-name').textContent().catch(() => '')) === name, `${name} selected`)
    }
    await page.goto(`${origin}/?account_id=mp_sami`)
    await until(() => page.locator('.apt-card').count().then(n => n === 2), 'schedule loaded')

    await choose('Upcoming Patient')
    assert.equal(await button('Cancel').count(), 1, 'Cancel is offered before the appointment starts')
    assert.equal(await button('Mark no-show').count(), 0, 'no-show waits for the start time')

    await choose('Started Patient')
    assert.equal(await button('Cancel').count(), 0, 'no Cancel once the appointment has started')
    assert.equal(await button('Mark no-show').count(), 1, 'Mark no-show is offered instead')

    await choose('Upcoming Patient')
    await page.clock.runFor(31 * 60_000)
    await until(() => button('Mark no-show').count().then(n => n === 1), 'no-show unlocks at the start time')
    assert.equal(await button('Cancel').count(), 0, 'Cancel goes away when the start time passes')

    assert.deepEqual(writes, [], 'tests perform no mutations')
    assert.deepEqual(errors, [], 'no runtime errors')
    console.log(`PASS ${source}: Cancel before the start, Mark no-show after it, switching at the start time`)
    await context.close()
  }
} finally {
  await browser?.close()
  server.kill()
}
