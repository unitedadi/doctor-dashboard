import { fetchJson } from "./authFetch.js";

const DIRECTORY_CACHE_TTL_MS = 3 * 60 * 1000;
const directoryCache = new Map();

function cacheKey(apiBase, doctorId) {
  return `${apiBase || ""}:${doctorId || ""}`;
}

function directoryUrls(apiBase, doctorId) {
  const encodedDoctorId = encodeURIComponent(doctorId);
  return {
    patients: `${apiBase}/doctor/dashboard/patients?doctor_id=${encodedDoctorId}`,
    prescribable: `${apiBase}/doctor/rx/prescribable-patients?doctor_id=${encodedDoctorId}&limit=100&offset=0`,
  };
}

export function peekDoctorPatientDirectories({ apiBase, doctorId }) {
  return directoryCache.get(cacheKey(apiBase, doctorId))?.value || null;
}

export async function loadDoctorPatientDirectories({ apiBase, doctorId, force = false }) {
  const key = cacheKey(apiBase, doctorId);
  const current = directoryCache.get(key);
  const now = Date.now();

  if (!force && current?.value && now - current.value.fetchedAt < DIRECTORY_CACHE_TTL_MS) {
    return current.value;
  }
  if (current?.pending) return current.pending;

  const urls = directoryUrls(apiBase, doctorId);
  const pending = Promise.all([
    fetchJson(urls.patients),
    fetchJson(urls.prescribable).catch(() => ({ patients: [] })),
  ]).then(([patientPayload, prescribablePayload]) => {
    const value = {
      patients: Array.isArray(patientPayload?.patients) ? patientPayload.patients : [],
      prescribablePatients: Array.isArray(prescribablePayload?.patients) ? prescribablePayload.patients : [],
      fetchedAt: Date.now(),
    };
    directoryCache.set(key, { value, pending: null });
    return value;
  }).catch((error) => {
    directoryCache.set(key, { value: current?.value || null, pending: null });
    throw error;
  });

  directoryCache.set(key, { value: current?.value || null, pending });
  return pending;
}

export function clearDoctorPatientDirectoryCache() {
  directoryCache.clear();
}
