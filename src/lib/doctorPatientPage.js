import { fetchJson } from './authFetch.js';

const pending = new Map();

export function loadDoctorPatientPage({ apiBase, doctorId, search = '', offset = 0, patientId = '' }) {
  const params = new URLSearchParams({ doctor_id: doctorId, q: search, offset: String(offset), limit: '30' });
  if (patientId) params.set('patient_id', patientId);
  const url = `${apiBase}/doctor/patient-directory?${params}`;
  if (!pending.has(url)) {
    pending.set(url, fetchJson(url).finally(() => pending.delete(url)));
  }
  return pending.get(url);
}
