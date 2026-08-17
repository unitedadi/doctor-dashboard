import test from "node:test";
import assert from "node:assert/strict";

import {
  clearDoctorPatientDirectoryCache,
  loadDoctorPatientDirectories,
  peekDoctorPatientDirectories,
} from "../src/lib/doctorPatientDirectory.js";

test("deduplicates and reuses the authorized patient directory during the cache window", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    clearDoctorPatientDirectoryCache();
  });

  clearDoctorPatientDirectoryCache();
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const body = String(url).includes("prescribable-patients")
      ? { patients: [{ patient_id: "patient-1", can_prescribe: true }] }
      : { patients: [{ id: "patient-1", name: "Aditya Yadav" }] };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const request = { apiBase: "https://api.example", doctorId: "doctor_sami" };
  const [first, duplicate] = await Promise.all([
    loadDoctorPatientDirectories(request),
    loadDoctorPatientDirectories(request),
  ]);
  const cached = await loadDoctorPatientDirectories(request);

  assert.equal(calls.length, 2);
  assert.equal(first, duplicate);
  assert.equal(cached, first);
  assert.equal(peekDoctorPatientDirectories(request), first);
  assert.equal(first.patients[0].name, "Aditya Yadav");
});
