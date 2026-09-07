import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const prescribe = await readFile(new URL('../src/components/prescribe.jsx', import.meta.url), 'utf8');

test('issuing a prescription refreshes the backend-owned inbox counts', () => {
  assert.match(app, /onSent=\{\(\) => setClinicalRevision\(\(revision\) => revision \+ 1\)\}/);
  assert.match(app, /\}, \[route, clinicalRevision\]\)/);
});

test('successful prescribing does not reload eligible patients and clear its confirmation', () => {
  const success = prescribe.slice(prescribe.indexOf('setTimeout(() => setSentToast(""), 2600);'));
  assert.match(success, /if \(onSent\) onSent\(\);/);
  assert.doesNotMatch(success.split('} catch (err)')[0], /loadPatients\(/);
});
