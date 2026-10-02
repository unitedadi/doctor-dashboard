import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/refillMedicationContext.jsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { fileName: 'refillMedicationContext.jsx', compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } });
const exports = {};
new Function('require', 'exports', compiled.outputText)(createRequire(import.meta.url), exports);
const render = context => renderToStaticMarkup(React.createElement(exports.default, { context }));
const purchase = { order_id: 'synthetic-order', paid_at: '2026-09-10T10:00:00Z', delivered_at: '2026-09-11T10:00:00Z', items: [{ name: 'Medication 5 mg', quantity: 1 }] };

test('labels a previous purchase as history, not the current prescribed dose', () => {
  const html = render({ previous_purchase: purchase, care_plans: [], prior_prescription: null });
  assert.match(html, /Medication 5 mg/);
  assert.match(html, /11 Sept 2026/);
  assert.match(html, /Historical record/);
  assert.match(html, /Confirm the patient’s current medication and dose/);
  assert.match(html, /a purchase alone is not a prescription/);
  assert.doesNotMatch(html, /<dt>Current medication/);
});

test('renders exact linked superseded plan instructions and consultation notes', () => {
  const html = render({ previous_purchase: purchase, care_plans: [{ care_plan_id: 'plan', title: 'Prior plan', status: 'SUPERSEDED', doctor_name: 'Test Doctor', summary: 'Clinical summary', consultation: { status: 'COMPLETED', note: 'Previous assessment' }, items: [{ name: 'Medication 5 mg', doctor_instructions: 'Previous instructions' }] }] });
  for (const value of ['Prior plan', 'Superseded', 'Test Doctor', 'Clinical summary', 'Previous assessment', 'Previous instructions']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /Clinical history unavailable/);
});

test('keeps canonical prescription provenance and escapes clinical free text', () => {
  const html = render({ previous_purchase: purchase, prior_prescription: { prescription_id: 'rx-1', rx_number: 'RX-1', doctor_name: 'Test Doctor', status: 'DELIVERED', items: [{ name: 'Medication 5 mg', doctor_instructions: '<script>alert(1)</script>' }] }, care_plans: [] });
  assert.match(html, /Prescription RX-1/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('missing context is visible and does not claim absence of a prior prescription', () => {
  const html = render(undefined);
  assert.match(html, /Previous purchase details are unavailable/);
  assert.match(html, /Clinical history unavailable/);
  assert.doesNotMatch(html, /No previous prescriptions/);
});

test('keeps linked medication visible when the purchase record is unavailable', () => {
  const html = render({ prior_prescription: { rx_number: 'RX-1', items: [{ name: 'Medication 5 mg' }] } });
  assert.match(html.split('<details')[0], /Medication 5 mg/);
  assert.match(html, /Previous purchase details are unavailable/);
  assert.match(html, /Historical treatment, not confirmation of current use/);
});

test('prescription review loads its exact request and has visible retry recovery', async () => {
  const prescribe = await readFile(new URL('../src/components/prescribe.jsx', import.meta.url), 'utf8');
  assert.ok(prescribe.includes('/doctor/rx/refill-requests/${encodeURIComponent(initialRefillRequestId)}?'));
  assert.ok(prescribe.includes('refillContextReady && cart.length'));
  assert.ok(prescribe.includes('match.patient_id !== initialPatientId'));
  assert.ok(prescribe.includes('match.customer_id !== initialCustomerId'));
  assert.ok(prescribe.includes('onRetry={'));
  assert.equal((prescribe.match(/refillMedicationContext=\{refillContext\?\.medicationContext\}/g) || []).length, 2);
  assert.ok(prescribe.includes('workflowMode === "refill" ? "Refill request" : "Completed consult"'));
  assert.ok(!prescribe.includes('status: "all", limit: "100", offset: "0"'));
});
