import test from "node:test";
import assert from "node:assert/strict";

import {
  availableConsultOutcomes,
  buildConsultOutcomePayload,
  calendarDaysForMonth,
  combineDubaiFollowUpValue,
  consultOutcomeAfterSave,
  consultOutcomeErrorMessage,
  defaultDubaiFollowUpValue,
  minimumDubaiFollowUpValue,
  shiftCalendarMonth,
  splitDubaiFollowUpValue,
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
    note: "Lifestyle changes are sufficient at this time.",
    followUpLocal: "2026-08-17T15:00",
    now: fixedNow,
  }), {
    outcome: "NO_MEDICATION_NEEDED",
    note: "Lifestyle changes are sufficient at this time.",
  });
});

test("requires a clinical note for every doctor-reported outcome", () => {
  for (const { value: outcome } of availableConsultOutcomes("rx")) {
    assert.throws(
      () => buildConsultOutcomePayload({
        outcome,
        note: "   ",
        followUpLocal: "2026-08-17T15:00",
        now: fixedNow,
      }),
      /Enter a clinical note/,
      outcome,
    );
  }
});

test("rejects a missing or past patient-undecided reminder before submission", () => {
  assert.throws(
    () => buildConsultOutcomePayload({
      outcome: "PATIENT_UNDECIDED",
      note: "Patient needs time to decide.",
      followUpLocal: "",
      now: fixedNow,
    }),
    /Choose a follow-up date and time/,
  );
  assert.throws(
    () => buildConsultOutcomePayload({
      outcome: "PATIENT_UNDECIDED",
      note: "Patient needs time to decide.",
      followUpLocal: "2026-08-16T14:00",
      now: fixedNow,
    }),
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
  assert.equal(
    consultOutcomeErrorMessage("validation_error", { details: { fieldErrors: { note: ["note_required"] } } }),
    "Enter a clinical note.",
  );
});

test("builds the custom calendar without changing the backend date-time value", () => {
  assert.deepEqual(splitDubaiFollowUpValue("2026-08-17T15:30"), { dateKey: "2026-08-17", time: "15:30" });
  assert.equal(combineDubaiFollowUpValue("2026-08-19", "09:15"), "2026-08-19T09:15");
  assert.equal(shiftCalendarMonth("2026-12", 1), "2027-01");

  const august = calendarDaysForMonth("2026-08");
  assert.equal(august.length, 42);
  assert.equal(august[5], "2026-08-01");
  assert.equal(august[35], "2026-08-31");
});
