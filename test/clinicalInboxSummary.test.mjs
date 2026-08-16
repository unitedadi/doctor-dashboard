import test from "node:test";
import assert from "node:assert/strict";

import {
  clinicalTaskCategory,
  isDoctorClinicalTask,
  summarizeClinicalInboxTasks,
} from "../src/lib/clinicalInboxSummary.js";
import { doctorChatPushRecovery } from "../src/lib/doctorChatPush.js";

test("normalizes legacy refill tasks", () => {
  assert.equal(clinicalTaskCategory({ type: "REFILL_REVIEW" }), "refill_review");
});

test("counts actionable reply and refill work without using unread-message totals", () => {
  const summary = summarizeClinicalInboxTasks([
    { category: "message_needs_response", action: "REPLY_TO_PATIENT" },
    { category: "message_needs_response", action: "REPLY_TO_PATIENT" },
    { category: "refill_review", action: "PRESCRIBE_REFILL" },
    { category: "needs_outcome", action: "RECORD_CONSULT_OUTCOME" },
    { category: "ops_follow_up", action: "FOLLOW_UP" },
  ]);

  assert.deepEqual(summary, { total: 4, needsReply: 2, refillReview: 1 });
});

test("rejects unsupported actions even when the category name looks clinical", () => {
  assert.equal(isDoctorClinicalTask({ category: "refill_review", action: "REFUND_PAYMENT" }), false);
});

test("provides visible recovery guidance when browser notifications are blocked", () => {
  assert.deepEqual(doctorChatPushRecovery("blocked"), {
    title: "Alerts are blocked in this browser",
    detail: "Open this site's browser settings, set Notifications to Allow, then check again.",
    action: "Check again",
  });
  assert.equal(doctorChatPushRecovery("on"), null);
});
