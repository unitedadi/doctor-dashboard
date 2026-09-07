import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadDoctorPatientPage } from '../src/lib/doctorPatientPage.js';

test('customer-only chart links retain the existing customer-to-patient lookup', async () => {
  const source = await readFile(new URL('../src/components/patients.jsx', import.meta.url), 'utf8');
  assert.match(source, /const pagedDirectory = embedded && !LOCAL_PREVIEW && \(!initialCustomerId \|\| Boolean\(initialPatientId\)\)/);
  assert.match(source, /if \(pagedDirectory\) return;/);
  assert.match(source, /nextPatients\.find\(\(patient\) => patient\.customerId === initialCustomerId\)/);
});

test('patient page deduplicates in-flight reads and keeps searches and doctors separate', async () => {
  const original = globalThis.fetch;
  const urls = [];
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  globalThis.fetch = async (url) => {
    urls.push(url);
    await pending;
    return { ok: true, json: async () => ({ patients: [], total: 0 }) };
  };
  try {
    const args = { apiBase: '/api', doctorId: 'doctor-a', search: 'Mira', offset: 30 };
    const first = loadDoctorPatientPage(args);
    const same = loadDoctorPatientPage(args);
    const other = loadDoctorPatientPage({ ...args, doctorId: 'doctor-b' });
    assert.equal(first, same);
    assert.equal(urls.length, 2);
    assert.match(urls[0], /patient-directory/);
    assert.match(urls[0], /offset=30/);
    resolve();
    await Promise.all([first, same, other]);
    await loadDoctorPatientPage(args);
    assert.equal(urls.length, 3, 'completed clinical reads must not be cached indefinitely');
  } finally {
    globalThis.fetch = original;
  }
});
