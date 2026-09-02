import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const prescribeSource = await readFile(new URL("../src/components/prescribe.jsx", import.meta.url), "utf8");
const clinicalUiSource = await readFile(new URL("../src/components/clinicalUi.jsx", import.meta.url), "utf8");
const dashboardStyles = await readFile(new URL("../src/styles/dashboard.css", import.meta.url), "utf8");

test("prescription blockers open an inline audited clinical profile correction", () => {
  assert.match(prescribeSource, /rx_clinical_details_incomplete:/);
  assert.match(prescribeSource, /Clinical details need review/);
  assert.match(prescribeSource, /Update clinical profile/);
  assert.match(prescribeSource, /\/doctor\/patients\/\$\{encodeURIComponent\(patientId\)\}\/clinical-profile/);
  assert.match(prescribeSource, /setPatientChart\(patientFile\)/);
  assert.match(prescribeSource, /Review and issue the prescription/);
});

test("clinical correction covers the safety fields requested by doctors", () => {
  assert.match(prescribeSource, /medical_conditions_json:/);
  assert.match(prescribeSource, /pregnancy_status:/);
  assert.match(prescribeSource, /breastfeeding_status:/);
  assert.match(prescribeSource, /Trying to conceive or planning a pregnancy/);
  assert.match(prescribeSource, /backendFields\.length \? backendFields : \["medical_conditions"\]/);
  assert.match(prescribeSource, /regular_medications_text:/);
  assert.match(prescribeSource, /allergies_json:/);
  assert.match(prescribeSource, /!hasClinicalBlocker/);
});

test("the prescription safety banner returns after correction with pregnancy status", () => {
  assert.match(clinicalUiSource, /pregnancyStatus = ""/);
  assert.match(prescribeSource, /pregnancyStatus=\{patientChart\?\.clinical\?\.assessment\?\.basic\?\.pregnancy_status\}/);
  assert.match(prescribeSource, /!isQuickWlpMode && !hasClinicalBlocker/);
  assert.match(dashboardStyles, /\.clinical-profile-form select/);
});
