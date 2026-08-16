import test from "node:test";
import assert from "node:assert/strict";

import {
  availableConsultOutcomes,
  buildConsultOutcomePayload,
  consultOutcomeAfterSave,
  consultOutcomeErrorMessage,
  defaultDubaiFollowUpValue,
  minimumDubaiFollowUpValue,
} from "../src/lib/consultOutcome.js";

const fixedNow = new Date("2026-08-16T11:00:00.000Z");

test("hides continue-treatment for Quick Consult but keeps it for Lifestyle Rx", () => {
  assert.equal(availableConsultOutcomes("quickwlp").some((option) => option.value === "CONTINUE_EXISTING_TREATMENT"), false);
  assert.equal(availableConsultOutcomes("rx").some((option) => option.value === "CONTINUE_EXISTING_TREATMENT"), true);
});

test("adds the required Dubai-offset reminder only for patient undecided", () => {
  assert.deepEqual(buildConsultOutcomePayload({
    outcome: "PATIENT_UNDECIDED",
    note: "  Call after discussing with family.  ",
    followUpLocal: "2026-08-17T15:00",
    now: fixedNow,
  }), {
    outcome: "PATIENT_UNDECIDED",
    note: "Call after discussing with family.",
    follow_up_at: "2026-08-17T15:00:00+04:00",
  });

  assert.deepEqual(buildConsultOutcomePayload({
    outcome: "NO_MEDICATION_NEEDED",
    note: "",
    followUpLocal: "2026-08-17T15:00",
    now: fixedNow,
  }), {
    outcome: "NO_MEDICATION_NEEDED",
    note: null,
  });
});

test("rejects a missing or past patient-undecided reminder before submission", () => {
  assert.throws(
    () => buildConsultOutcomePayload({ outcome: "PATIENT_UNDECIDED", followUpLocal: "", now: fixedNow }),
    /Choose a follow-up date and time/,
  );
  assert.throws(
    () => buildConsultOutcomePayload({ outcome: "PATIENT_UNDECIDED", followUpLocal: "2026-08-16T14:00", now: fixedNow }),
    /Choose a future follow-up time in Dubai/,
  );
});

test("routes prescription-needed after save and refreshes every terminal outcome", () => {
  assert.equal(consultOutcomeAfterSave("PRESCRIPTION_NEEDED"), "PRESCRIBE");
  assert.equal(consultOutcomeAfterSave("OPS_FOLLOW_UP_NEEDED"), "REFRESH");
  assert.equal(consultOutcomeAfterSave("NOT_ELIGIBLE"), "REFRESH");
});

test("provides Dubai-local defaults and human clinical errors", () => {
  assert.equal(defaultDubaiFollowUpValue(fixedNow), "2026-08-17T15:00");
  assert.equal(minimumDubaiFollowUpValue(fixedNow), "2026-08-16T15:05");
  assert.equal(
    consultOutcomeErrorMessage("existing_treatment_plan_not_found"),
    "No active treatment plan is available to continue. Choose another outcome.",
  );
  assert.equal(
    consultOutcomeErrorMessage("validation_error", { details: { fieldErrors: { follow_up_at: ["follow_up_at_required"] } } }),
    "Choose a follow-up date and time.",
  );
});
