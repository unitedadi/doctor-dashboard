import test from 'node:test';
import assert from 'node:assert/strict';
import { patientIdFromPath, patientDeepLinkRedirect } from '../src/lib/patientDeepLink.js';

const id = 'PAT-0123456789ABCDEF0123456789ABCDEF';

test('both chart URL formats identify the exact patient', () => {
  assert.equal(patientIdFromPath(`/${id}`), id);
  assert.equal(patientIdFromPath(`/patients/${id}/`), id);
  assert.equal(patientIdFromPath(`/patients/${id.toLowerCase()}`), id);
});

test('unrelated and malformed paths retain their existing navigation', () => {
  for (const path of ['/', '/patients', '/PAT-invalid', `/${id}/extra`, `/other/${id}`]) {
    assert.equal(patientIdFromPath(path), null);
  }
});

test('sign-in returns to the same chart path and query, without Clerk hash state', () => {
  assert.equal(patientDeepLinkRedirect(new URL(`https://rx.dardoc.com/patients/${id}?workspace=test#/sign-in`)),
    `https://rx.dardoc.com/patients/${id}?workspace=test`);
  assert.equal(patientDeepLinkRedirect(new URL('https://rx.dardoc.com/?view=clinical-inbox')), undefined);
});
