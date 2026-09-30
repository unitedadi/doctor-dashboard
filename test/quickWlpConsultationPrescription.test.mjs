import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/prescribe.jsx', import.meta.url), 'utf8');
const publish = source.slice(source.indexOf('const publishPrescription ='));
const payloadSource = publish.slice(publish.indexOf('const payload ='), publish.indexOf('const data = await fetchJson'));
const payload = new Function('isQuickWlpMode', 'isAmendMode', 'initialConsultationId', 'patient',
  'quickWlpDoctorId', 'quickWlpSellerId', 'items', 'amendReason', `${payloadSource}; return payload;`);

test('QuickWLP prescribing sends the exact consultation opened by the doctor', () => {
  const result = payload(true, false, 'followup-2', { doctorId: 'doctor-1' }, 'doctor-1', 'seller-1', [], '');
  assert.equal(result.consultation_id, 'followup-2');
  assert.equal(result.doctor_id, 'doctor-1');
});

test('amendment keeps its original prescription context instead of rebinding to a later visit', () => {
  const result = payload(true, true, 'followup-2', { doctorId: 'doctor-1' }, 'doctor-1', 'seller-1', [], 'Correct instruction');
  assert.equal('consultation_id' in result, false);
  assert.equal(result.reason, 'Correct instruction');
});

test('legacy QuickWLP entry without a consultation retains the existing request contract', () => {
  const result = payload(true, false, '', { doctorId: 'doctor-1' }, 'doctor-1', 'seller-1', [], '');
  assert.equal('consultation_id' in result, false);
});
