import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

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
function appointment(id, name, time, date, doctorId) {
  return {
    id, source: id === 'first' ? 'rx' : 'quickwlp', patient_id: `patient_${id}`, quickwlp_lead_id: `lead_${id}`,
    time, date, duration_minutes: 15, service_name: 'Quick Consult', visit_type: 'phone',
    status: 'upcoming', track_key: 'weight-loss', doctor_id: doctorId,
    scheduled_start_at: `${date}T${time}:00+04:00`,
    patient: { id: `patient_${id}`, name, initials: name[0], phone: '+971500000000' },
  }
}
try {
  await until(async () => {
    if (server.exitCode !== null) throw new Error(serverOutput)
    return fetch(origin).then(r => r.ok).catch(() => false)
  }, 'local test server')
  browser = await chromium.launch({ channel: 'chromium' })
  for (const [account, doctorId] of [['mp_sami', 'doctor_sami_dev'], ['mp_marwa', 'doctor_marwa']]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const errors = []
    const writes = []
    const requests = []
    const deferred = []
    let mode = 'ok'
    let added = false
    let renamed = false
    page.on('pageerror', error => errors.push(error.message))
    await page.clock.install({ time: new Date('2026-09-24T06:00:00Z') })
    await page.clock.pauseAt(new Date('2026-09-24T06:00:00Z'))
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
        requests.push({ date, doctor: url.searchParams.get('doctor_id') })
        const data = {
          today: [
            ...(added ? [appointment('new', `New Patient ${date}`, '14:00', date, doctorId)] : []),
            appointment('first', 'First Patient', '15:00', date, doctorId),
            appointment('selected', renamed ? 'Selected Updated' : 'Selected Patient', '16:00', date, doctorId),
          ], week: [],
        }
        if (mode === 'error') return route.fulfill({ status: 500, json: { error: 'test_outage' } })
        if (mode === 'invalid') return route.fulfill({ json: {} })
        if (mode === 'hold') await new Promise(resolve => deferred.push(resolve))
        return route.fulfill({ json: data }).catch(() => {})
      }
      return route.fulfill({ json: { patients: [], tasks: [], metrics: {} } })
    })
    const ready = () => until(() => page.getByRole('button', { name: 'Refresh schedule', exact: true }).isEnabled().catch(() => false), 'refresh completed')
    const count = () => page.locator('.apt-card').count()
    const selected = () => page.locator('.workbench-name').textContent()
    const refresh = async event => {
      const before = requests.length
      await page.evaluate(type => window.dispatchEvent(new Event(type)), event)
      await until(() => requests.length > before, `${event} refresh`)
      await ready()
    }
    await page.goto(`${origin}/?account_id=${account}`)
    await ready()
    assert.equal(await count(), 2)
    await page.locator('.apt-card').filter({ hasText: 'Selected Patient' }).click()
    assert.equal(await selected(), 'Selected Patient')

    added = true
    await page.clock.runFor(30_000)
    await until(async () => await count() === 3, 'new appointment appears without reload')
    await ready()
    assert.equal(await selected(), 'Selected Patient', 'selection survives automatic refresh')
    assert.match(await page.locator('.nav-item').filter({ hasText: 'Schedule' }).textContent(), /3/)
    assert.equal(await page.locator('.apt-loading').count(), 0)
    assert.match(await page.locator('.apt-refresh-status').textContent(), /Updated/)
    console.log(`PASS ${account}: polling, new booked patient without DOB, selected patient and sidebar count`)

    renamed = true
    await refresh('focus')
    assert.equal(await selected(), 'Selected Updated')
    await refresh('online')
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    const hiddenCount = requests.length
    await page.clock.runFor(60_000)
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    assert.equal(requests.length, hiddenCount, 'no polling or focus refresh while hidden')
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await until(() => requests.length > hiddenCount, 'visibility return refresh')
    await ready()
    console.log(`PASS ${account}: focus, reconnect, hidden pause and visibility return`)

    const lastGoodStatus = await page.locator('.apt-refresh-status span').textContent()
    for (const failure of ['error', 'invalid']) {
      mode = failure
      await refresh('focus')
      assert.equal(await count(), 3, `${failure} preserves last good schedule`)
      assert.equal(await selected(), 'Selected Updated')
      assert.match(await page.getByRole('alert').textContent(), /New bookings or changes may be missing/)
      assert.equal(await page.locator('.apt-refresh-status span').textContent(), lastGoodStatus)
    }
    mode = 'ok'
    await page.getByRole('button', { name: 'Retry refresh' }).click()
    await ready()
    assert.equal(await page.getByRole('alert').count(), 0)
    console.log(`PASS ${account}: API outage/malformed response preserves data, visible warning, recovery`)

    mode = 'hold'
    const beforeBurst = requests.length
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('online'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await until(() => deferred.length === 1, 'held refresh')
    assert.equal(requests.length, beforeBurst + 1, 'deduplicates overlapping refresh events')
    assert.equal(await selected(), 'Selected Updated', 'slow background refresh never blanks workbench')
    await page.clock.runFor(15_001)
    await ready()
    assert.match(await page.getByRole('alert').textContent(), /Could not refresh/)
    deferred.shift()()
    mode = 'ok'
    await refresh('online')
    assert.equal(await page.getByRole('alert').count(), 0)
    console.log(`PASS ${account}: overlap deduplication, slow response, timeout and retry`)

    mode = 'hold'
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await until(() => deferred.length === 1, 'old date request held')
    mode = 'ok'
    await page.getByRole('button', { name: 'Tomorrow', exact: true }).click()
    await ready()
    assert.equal(requests.at(-1).date, '2026-09-25')
    deferred.shift()()
    await delay(100)
    assert.match(await page.locator('.topbar').textContent(), /25/)
    assert.equal(await count(), 3)
    assert.equal(await page.locator('.apt-card').filter({ hasText: 'New Patient 2026-09-25' }).count(), 1)
    assert.equal(await page.locator('.apt-card').filter({ hasText: 'New Patient 2026-09-24' }).count(), 0, 'late response cannot replace the new date')
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await ready()
    mode = 'error'
    await page.getByRole('button', { name: 'Tomorrow', exact: true }).click()
    await ready()
    assert.equal(await count(), 0, 'failed date change must not show previous date bookings')
    assert.equal(await page.getByText('No consultations scheduled for this day', { exact: true }).count(), 0, 'failure is not an empty schedule')
    mode = 'ok'
    await page.getByRole('button', { name: 'Retry refresh' }).click()
    await ready()
    console.log(`PASS ${account}: date change cancels stale request, failed date never shows wrong appointments`)

    await page.screenshot({ path: `/tmp/doctor-schedule-refresh-${account}.png`, fullPage: true, animations: 'disabled' })
    await page.locator('.nav-item').filter({ hasText: 'Clinical inbox' }).click()
    await delay(100)
    const unmountedCount = requests.length
    await page.clock.runFor(60_000)
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('online'))
    })
    assert.equal(requests.length, unmountedCount, 'unmounted schedule stops polling and listeners')
    assert.ok(requests.every(r => r.doctor === doctorId), 'all refreshes stay scoped to the signed-in doctor')
    assert.deepEqual(writes, [], 'tests perform no mutations')
    assert.deepEqual(errors, [], 'no browser runtime errors')
    console.log(`PASS ${account}: cleanup, doctor scoping, no mutations or runtime errors`)
    await context.close()
  }
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
