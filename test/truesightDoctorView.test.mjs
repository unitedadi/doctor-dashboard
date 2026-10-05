import test from "node:test";
import assert from "node:assert/strict";

import { trueSightConversationEntries, trueSightSummaryLayers } from "../src/lib/truesightDoctorView.js";

const summary = {
  available: true,
  label: "TrueSight is DarDoc's AI companion, not a clinician.",
  as_of: "2026-10-01T13:00:00.000Z",
  understand: { programme: "Weight Loss", medicine: "Tirzepatide", dose_label: "2.5 mg weekly", supply: "DELIVERED", next_dose_on: "2026-10-03" },
  measure: {
    weight: { available: true, current_kg: 98.4, change_kg: -3.2, goal_kg: 85 },
    doses_on_time: { taken: 3, expected: 4 },
    sleep: { available: true, value: 5.9, unit: "h", usual: 7.1 },
    resting_heart_rate: { available: true, value: 68, unit: "bpm", usual: 63 },
    hrv: { available: false, value: null, unit: "ms", usual: null },
    steps: { available: true, value: 9275, unit: "steps", usual: null },
    devices: { connected: ["apple", "whoop"] },
  },
  find: { noticed: null },
  help: { last_14_days: { sent: 6, seen: 5, answered: 2, patient_messages: 4 }, recent: [{ at: "2026-10-01T09:01:00.000Z", headline: "Sleep caught up yet?" }] },
  follow_through: {
    questions: [{ question: "Asks about staying on 2.5 mg another week.", urgency: "URGENT", overdue: true }],
    watching: [{ due_at: "2026-10-01T15:00:00.000Z", purpose: "Look at the Whoop sleep for last night." }],
  },
};

test("lays a TrueSight summary out on the five layers with only the lines it has", () => {
  const layers = trueSightSummaryLayers(summary);
  assert.deepEqual(layers.map((layer) => layer.title), ["Understand", "Measure", "Find", "Help", "Follow through"]);
  const measure = Object.fromEntries(layers[1].rows.map((row) => [row.label, row.value]));
  assert.equal(measure.Weight, "98.4 kg · -3.2 kg since start · goal 85 kg");
  assert.equal(measure["Doses on time"], "3 of 4");
  assert.equal(measure.Sleep, "5.9 h (usually 7.1 h)");
  assert.equal(measure["Resting heart rate"], "68 bpm (usually 63 bpm)");
  assert.equal(measure.Steps, "9,275 steps");
  assert.equal(measure.HRV, undefined);
  assert.equal(measure.Devices, "Apple Health, Whoop");
  assert.deepEqual(layers[2].rows, []);
  assert.equal(layers[3].rows[0].value, "6 sent · 5 seen · 2 answered");
  assert.deepEqual(layers[4].rows.map((row) => row.label), ["Question · overdue", "Checks Oct 1, 7:00 PM"]);
});

test("shows nothing when TrueSight has nothing for the patient or the doctor view is off", () => {
  assert.equal(trueSightSummaryLayers({ available: false, reason: "not_enabled" }), null);
  assert.equal(trueSightSummaryLayers(null), null);
});

test("renders the conversation in each side's voice with how TrueSight's words landed", () => {
  const entries = trueSightConversationEntries([
    { side: "PATIENT", id: "e2", at: "2026-10-01T09:20:00.000Z", via: "TAP", text: "Barely slept" },
    { side: "TRUESIGHT", id: "p1", at: "2026-10-01T09:01:00.000Z", headline: "Sleep caught up yet?", message: "Did you get some sleep after work?",
      options: ["Barely slept", "Slept fine"], push: { sent: true }, seen_at: "2026-10-01T09:05:00.000Z", answered_at: null },
    { side: "PATIENT", id: "e1", at: "2026-09-30T22:14:00.000Z", via: "CHAT", text: "I have some work right now" },
  ]);
  assert.deepEqual(entries.map((entry) => [entry.side, entry.meta]), [
    ["patient", "Tapped"],
    ["truesight", "Choices: Barely slept · Slept fine · Push sent · Seen Oct 1, 1:05 PM"],
    ["patient", "Wrote to TrueSight"],
  ]);
  assert.equal(entries[1].title, "Sleep caught up yet?");
});
