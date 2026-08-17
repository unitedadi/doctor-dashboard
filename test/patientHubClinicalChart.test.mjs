import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const patientsSource = await readFile(new URL("../src/components/patients.jsx", import.meta.url), "utf8");
const patientChartSource = await readFile(new URL("../src/components/patientChart.jsx", import.meta.url), "utf8");

test("Patient Hub opens the complete chart in Production and local preview", () => {
  assert.match(patientsSource, /initialChart=\{LOCAL_PREVIEW \? localPreviewPatientChart\(p\) : undefined\}/);
  assert.match(patientsSource, /mode="full"/);
  assert.doesNotMatch(patientsSource, /mode=\{embedded \? "hub" : "full"\}/);
});

test("the complete chart exposes doctor notes with clinical and handoff categories", () => {
  assert.match(patientChartSource, /<DoctorNotes chart=\{chart\}/);
  assert.match(patientChartSource, /value: "CLINICAL_NOTE", label: "Clinical note"/);
  assert.match(patientChartSource, /value: "ADMIN_HANDOFF", label: "Handoff note"/);
  assert.match(patientChartSource, /contextType === "PATIENT_HUB" \? PATIENT_HUB_NOTE_CATEGORIES : NOTE_CATEGORIES/);
});

test("Patient Hub avoids repeating care and safety information", () => {
  assert.match(patientChartSource, /!focusedMode && focus !== "patient-hub"/);
  const profileStart = patientChartSource.indexOf('<ChartSection title="Clinical profile"');
  const profileEnd = patientChartSource.indexOf("</ChartSection>", profileStart);
  const profileSource = patientChartSource.slice(profileStart, profileEnd);
  assert.doesNotMatch(profileSource, /label="Current medication"/);
  assert.doesNotMatch(profileSource, /label="Allergies"/);
  assert.doesNotMatch(profileSource, /label="Conditions"/);
});
