import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Run with VITE_SKIP_CLERK=1 VITE_LOCAL_PREVIEW_DATA=false VITE_API_BASE=/qa-api.
// All APIs are intercepted. This never contacts a patient or a deployed backend.
const origin = 'http://127.0.0.1:5307';
const output = new URL('../output/intake-whatsapp/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const scenario of ['send', 'delivered', 'read', 'unknown', 'disabled', 'missing-phone', 'network-error', 'already-submitted']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    let status = scenario === 'delivered' ? 'DELIVERED' : scenario === 'read' ? 'READ' : scenario === 'unknown' ? 'CHECK_REQUIRED' : null;
    let sends = 0;
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/qa-api/')) return route.continue();
      if (url.pathname.endsWith('/request-intake')) {
        sends++;
        assert.deepEqual(route.request().postDataJSON(), { doctor_id: 'doctor_sami_dev', version: 1 });
        if (scenario === 'network-error') return route.abort();
        if (scenario === 'missing-phone') return route.fulfill({ status: 409, json: { error: 'intake_customer_phone_missing' } });
        await new Promise(resolve => setTimeout(resolve, 200));
        status = 'SENT';
        return route.fulfill({ json: { status } });
      }
      if (route.request().method() !== 'GET') throw new Error(`Unexpected write: ${url.pathname}`);
      if (url.pathname.endsWith('/clinical-inbox')) {
        const category = scenario === 'already-submitted' ? 'purchase_review' : 'purchase_intake';
        return route.fulfill({ json: { tasks: [{ id: 'purchase-review:QA-INTAKE', type: 'PURCHASE_REVIEW', category,
          inbox_queue: 'current', action: category === 'purchase_intake' ? 'COMPLETE_PURCHASE_INTAKE' : 'REVIEW_PURCHASE',
          action_label: category === 'purchase_intake' ? 'Patient details needed' : 'Review purchase prescription',
          source: 'product_purchase', source_id: 'QA-INTAKE', order_id: 'QA-INTAKE', customer_id: 'qa-customer',
          patient_id: null, doctor_id: null, track: 'Weight Loss', track_key: 'weight-loss', service: 'Medication purchase',
          occurred_at: '2026-10-12T06:00:00Z', review_version: 1, review_status: 'NOT_SUBMITTED',
          summary: 'Paid order needs patient details before clinical review.',
          patient: { name: 'Alex Example · Test patient', phone: '+971500000001' },
          items: [{ name: 'Purchased medication', quantity: 1 }],
          intake_whatsapp_enabled: scenario !== 'disabled', intake_whatsapp_status: status
        }], counts: { [category]: 1 }, current_counts: { [category]: 1 }, earlier_counts: {}, has_more: false } });
      }
      return route.fulfill({ json: url.pathname.endsWith('/appointments') ? [] : { tasks: [], patients: [], enabled: false, subscribed: false } });
    });
    await page.goto(`${origin}/?view=clinical-inbox&category=${scenario === 'already-submitted' ? 'purchase_review' : 'purchase_intake'}`);
    await page.getByRole('heading', { name: scenario === 'already-submitted' ? 'Purchased medication' : 'Complete patient intake', exact: true }).waitFor();
    const button = page.getByRole('button', { name: 'Request details on WhatsApp', exact: true });
    if (scenario === 'send') {
      await page.screenshot({ path: `${output}doctor-intake-request.png`, fullPage: true });
      await button.evaluate(el => { el.click(); el.click(); });
      await page.getByRole('status').filter({ hasText: 'WhatsApp sent' }).waitFor();
      assert.equal(sends, 1);
      await page.screenshot({ path: `${output}doctor-intake-sent.png`, fullPage: true });
      await page.reload();
      await page.getByRole('status').filter({ hasText: 'WhatsApp sent' }).waitFor();
      assert.equal(await button.count(), 0);
      assert.equal(sends, 1);
    } else if (scenario === 'disabled') {
      assert.equal(await button.isDisabled(), true);
    } else if (scenario === 'missing-phone' || scenario === 'network-error') {
      await button.click();
      await page.getByRole('alert').waitFor();
      assert.equal(sends, 1);
      if (scenario === 'network-error') assert.equal(await button.count(), 0);
    } else {
      assert.equal(await button.count(), 0);
      if (scenario === 'delivered' || scenario === 'read') await page.getByRole('status').filter({hasText:'WhatsApp delivered'}).waitFor();
      if (scenario === 'unknown') await page.getByRole('status').filter({hasText:'Request needs checking'}).waitFor();
    }
    assert.deepEqual(errors, []);
    results.push({ scenario, passed: true, send_requests: sends });
    await context.close();
  }
  await writeFile(`${output}browser-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
