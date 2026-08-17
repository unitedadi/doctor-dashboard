import test from "node:test";
import assert from "node:assert/strict";

import { normalizePhoneDigits, patientMatchesSearch } from "../src/lib/patientSearch.js";

const patient = {
  name: "Aditya Yadav",
  phone: "+971 50 213 8544",
  email: "aditya@example.com",
  city: "Dubai",
};

test("finds patients by name and existing directory fields", () => {
  assert.equal(patientMatchesSearch(patient, "aditya"), true);
  assert.equal(patientMatchesSearch(patient, "YADAV"), true);
  assert.equal(patientMatchesSearch(patient, "aditya@example.com"), true);
  assert.equal(patientMatchesSearch(patient, "Abu Dhabi"), false);
});

test("normalizes UAE international and local mobile formats", () => {
  assert.equal(normalizePhoneDigits("+971 50 213 8544"), "971502138544");
  assert.equal(normalizePhoneDigits("050-213-8544"), "971502138544");
  assert.equal(normalizePhoneDigits("00971 50 213 8544"), "971502138544");
});

test("finds the same patient using local, international, or partial mobile numbers", () => {
  assert.equal(patientMatchesSearch(patient, "0502138544"), true);
  assert.equal(patientMatchesSearch({ ...patient, phone: "0502138544" }, "+971502138544"), true);
  assert.equal(patientMatchesSearch(patient, "502138"), true);
  assert.equal(patientMatchesSearch(patient, "0559999999"), false);
});
