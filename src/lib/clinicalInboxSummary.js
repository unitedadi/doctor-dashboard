const DOCTOR_TASK_CATEGORIES = new Set([
  "purchase_review",
  "purchase_intake",
  "needs_prescription",
  "needs_outcome",
  "message_needs_response",
  "reissue",
  "refill_review",
  "lab_results_ready",
]);

const DOCTOR_TASK_ACTIONS = new Set([
  "REVIEW_PURCHASE",
  "COMPLETE_PURCHASE_INTAKE",
  "PRESCRIBE_RX",
  "PRESCRIBE_QUICK_WLP",
  "PRESCRIBE_REFILL",
  "REPLY_TO_PATIENT",
  "REISSUE_PRESCRIPTION",
  "AMEND_PRESCRIPTION",
  "RECORD_CONSULT_OUTCOME",
  "REVIEW_LAB_RESULTS",
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

export function summarizeClinicalInboxTasks(tasks, counts) {
  const visibleTasks = Array.isArray(tasks) ? tasks.filter(isDoctorClinicalTask) : [];
  const count = category => counts ? Number(counts[category] || 0) : visibleTasks.filter(task => clinicalTaskCategory(task) === category).length;
  return {
    total: counts ? [...DOCTOR_TASK_CATEGORIES].reduce((total, category) => total + count(category), 0) : visibleTasks.length,
    needsOutcome: count("needs_outcome"),
    purchaseReview: count("purchase_review"),
    purchaseIntake: count("purchase_intake"),
    needsPrescription: count("needs_prescription"),
    needsReply: count("message_needs_response"),
    refillReview: count("refill_review"),
  };
}
