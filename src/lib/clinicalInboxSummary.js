const DOCTOR_TASK_CATEGORIES = new Set([
  // A question the patient asked TrueSight to pass on; they were told it was flagged to their doctor.
  "truesight_question",
  "needs_prescription",
  "needs_outcome",
  "message_needs_response",
  "reissue",
  "refill_review",
  "lab_results_ready",
]);

const DOCTOR_TASK_ACTIONS = new Set([
  "PRESCRIBE_RX",
  "PRESCRIBE_QUICK_WLP",
  "PRESCRIBE_REFILL",
  "REPLY_TO_PATIENT",
  "REISSUE_PRESCRIPTION",
  "AMEND_PRESCRIPTION",
  "RECORD_CONSULT_OUTCOME",
  "REVIEW_LAB_RESULTS",
  "RESOLVE_TRUESIGHT_QUESTION",
]);

export function clinicalTaskCategory(task) {
  const explicit = String(task?.category || "").toLowerCase();
  if (explicit) return explicit;
  return String(task?.type || "").toUpperCase() === "REFILL_REVIEW"
    ? "refill_review"
    : "needs_prescription";
}

export function isDoctorClinicalTask(task) {
  if (!task) return false;
  if (!DOCTOR_TASK_CATEGORIES.has(clinicalTaskCategory(task))) return false;
  const action = String(task.action || "").toUpperCase();
  return !action || DOCTOR_TASK_ACTIONS.has(action);
}

export function summarizeClinicalInboxTasks(tasks) {
  const visibleTasks = Array.isArray(tasks) ? tasks.filter(isDoctorClinicalTask) : [];
  return {
    total: visibleTasks.length,
    needsReply: visibleTasks.filter((task) => clinicalTaskCategory(task) === "message_needs_response").length,
    refillReview: visibleTasks.filter((task) => clinicalTaskCategory(task) === "refill_review").length,
    truesightQuestions: visibleTasks.filter((task) => clinicalTaskCategory(task) === "truesight_question").length,
  };
}
