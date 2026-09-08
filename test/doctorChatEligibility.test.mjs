import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const component = (name) => readFile(new URL(`../src/components/${name}.jsx`, import.meta.url), 'utf8');

test('patient and chat views do not override membership using Quick Consult prescription history', async () => {
  const patients = await component('patients');
  const chat = await component('chat');
  assert.match(patients, /chat: item\.chat \|\| \{ available: false/);
  assert.doesNotMatch(chat, /isQuickConsultOnlyPatientRecord|quick_consult_no_chat/);
  assert.match(chat, /patient\?\.chat\?\.available !== true/);
  assert.match(chat, /setChatError\(patient\?\.chat\?\.unavailable_message/);
});

test('direct chat matches the patient and customer together, never an account-only fallback', async () => {
  const chat = await component('chat');
  assert.match(chat, /item\.id === patientId && \(!customerId \|\| item\.customer_id === customerId\)/);
  assert.match(chat, /item\.id === hubPatientId && \(!hubCustomerId \|\|/);
  assert.doesNotMatch(chat, /item\.id === (?:patientId|hubPatientId) \|\|/);
});

test('schedule and chart Message controls use backend availability and show its explanation', async () => {
  const appointments = await component('appointments');
  const chart = await component('patientChart');
  assert.match(appointments, /disabled=\{selected\.chat\?\.available !== true\}/);
  assert.match(chart, /disabled=\{chart\?\.program\?\.chat\?\.available !== true\}/);
  assert.match(chart, /chart\.program\.chat\.unavailable_message/);
  assert.match(chart, /chart\.program\?\.membership_label/);
  assert.doesNotMatch(chart, /return "Weight Loss Rx"/);
});
