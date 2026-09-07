import assert from 'node:assert/strict';
import test from 'node:test';
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
