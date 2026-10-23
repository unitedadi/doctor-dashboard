import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { prescriptionAmendmentContext } from '../src/lib/prescriptionAmendment.js';

test('Quick Peptides amendment preserves the prescribed track, seller and items', () => {
  const context = prescriptionAmendmentContext(
    { id: 'patient', customer_id: 'customer', track_key: 'weight-loss' },
    { id: 'rx', lead_id: 'lead', source: 'quickwlp_prescription', track_key: 'peptides', seller_id: 'arena', b2b_promo_code: 'PARTNER', items: [{ product_id: 'bpc', quantity: 1 }] },
    'doctor'
  );
  assert.equal(context.quickWlpTrackKey, 'peptides');
  assert.equal(context.quickWlpSellerId, 'arena');
  assert.equal(context.quickWlpPromoCode, 'PARTNER');
  assert.equal(context.amendId, 'rx');
  assert.equal(context.prescriptionMode, 'reissue');
  assert.deepEqual(JSON.parse(context.amendItems), [{ product_id: 'bpc', quantity: 1 }]);
});

test('Lifestyle Rx amendments retain the prescription track and care plan route', () => {
  const context = prescriptionAmendmentContext({ id: 'patient' }, { id: 'plan', source: 'rx_care_plan', track_key: 'peptides', items: [] }, 'doctor');
  assert.equal(context.trackKey, 'peptides');
  assert.equal(context.quickWlpLeadId, undefined);
});

test('refill-origin reissues retain the exact member even without a consultation', () => {
  const context = prescriptionAmendmentContext(
    { id: 'member-a', customer_id: 'family-account', name: 'Test Member' },
    { id: 'refill-rx', source: 'quickwlp_prescription', lead_id: 'retention-lead', items: [] },
    'doctor'
  );
  assert.equal(context.patientId, 'member-a');
  assert.equal(context.customerId, 'family-account');
  assert.equal(context.quickWlpLeadId, 'retention-lead');
  assert.equal(context.prescriptionMode, 'reissue');
});

test('reissue demographics uses the member route, while new consult prescriptions keep the lead route', async () => {
  const source = await readFile(new URL('../src/components/prescribe.jsx', import.meta.url), 'utf8');
  assert.match(source, /patientId=\{isAmendMode \? initialPatientId : undefined\}/);
  assert.match(source, /leadId=\{isAmendMode \? undefined : initialQuickWlpLeadId\}/);
  assert.match(source, /key=\{isAmendMode \? initialPatientId : initialQuickWlpLeadId\}/);
  assert.match(source, /!isQuickWlpMode \|\| demographicsReady/);
});

test('missing reissue member fails closed instead of requesting an undefined member', async () => {
  const source = await readFile(new URL('../src/components/patientDemographics.jsx', import.meta.url), 'utf8');
  assert.match(source, /if \(!path\)/);
  assert.match(source, /member link is missing/);
  assert.ok(source.indexOf('if (!path)') < source.indexOf('fetchJson('));
});
