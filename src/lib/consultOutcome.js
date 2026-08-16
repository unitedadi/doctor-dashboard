export const CONSULT_OUTCOME_OPTIONS = [
  {
    value: "CONTINUE_EXISTING_TREATMENT",
    label: "Continue existing treatment",
    detail: "No new prescription from this consult. The task closes.",
  },
  {
    value: "PRESCRIPTION_NEEDED",
    label: "Prescription needed",
    detail: "You will be taken to prescribing for this patient.",
  },
  {
    value: "NO_MEDICATION_NEEDED",
    label: "No medication needed",
    detail: "The consult closes without medication.",
  },
  {
    value: "PATIENT_UNDECIDED",
    label: "Patient undecided",
    detail: "Choose when Support should follow up. The doctor task then closes.",
  },
  {
    value: "NOT_ELIGIBLE",
    label: "Not eligible",
    detail: "Do not prescribe at this time. The cycle closes.",
  },
  {
    value: "OPS_FOLLOW_UP_NEEDED",
    label: "Ops follow-up needed",
    detail: "Support follows up before the next clinical step.",
  },
];

function normalizedSource(source) {
  return String(source || "").trim().toLowerCase().replaceAll("-", "_");
}

export function availableConsultOutcomes(source) {
  const isQuickConsult = ["quickwlp", "quick_wlp", "quick_consult"].includes(normalizedSource(source));
  return isQuickConsult
    ? CONSULT_OUTCOME_OPTIONS.filter((option) => option.value !== "CONTINUE_EXISTING_TREATMENT")
    : CONSULT_OUTCOME_OPTIONS;
}

export function consultOutcomeAfterSave(outcome) {
  return outcome === "PRESCRIPTION_NEEDED" ? "PRESCRIBE" : "REFRESH";
}

export function dubaiDateTimeInputValue(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function defaultDubaiFollowUpValue(now = new Date()) {
  return dubaiDateTimeInputValue(new Date(now.getTime() + 24 * 60 * 60 * 1000));
}

export function minimumDubaiFollowUpValue(now = new Date()) {
  return dubaiDateTimeInputValue(new Date(now.getTime() + 5 * 60 * 1000));
}

export function splitDubaiFollowUpValue(value) {
  const match = String(value || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  return match ? { dateKey: match[1], time: match[2] } : { dateKey: "", time: "" };
}

export function combineDubaiFollowUpValue(dateKey, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return "";
  if (!/^\d{2}:\d{2}$/.test(String(time || ""))) return "";
  return `${dateKey}T${time}`;
}

export function shiftCalendarMonth(monthKey, offset) {
  const match = String(monthKey || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "";
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + Number(offset || 0), 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function calendarDaysForMonth(monthKey) {
  const match = String(monthKey || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return [];
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const mondayOffset = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - mondayOffset + 1;
    return day >= 1 && day <= daysInMonth
      ? `${monthKey}-${String(day).padStart(2, "0")}`
      : null;
  });
}

function futureDubaiOffsetIso(localValue, now) {
  const normalized = String(localValue || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    throw new Error("Choose a follow-up date and time.");
  }
  const offsetIso = `${normalized}:00+04:00`;
  const followUpMs = Date.parse(offsetIso);
  if (!Number.isFinite(followUpMs) || followUpMs <= now.getTime()) {
    throw new Error("Choose a future follow-up time in Dubai.");
  }
  return offsetIso;
}

export function buildConsultOutcomePayload({ outcome, note, followUpLocal, now = new Date() }) {
  const normalizedNote = String(note || "").trim();
  if (!normalizedNote) {
    throw new Error("Enter a clinical note.");
  }
  const payload = {
    outcome,
    note: normalizedNote,
  };
  if (outcome === "PATIENT_UNDECIDED") {
    payload.follow_up_at = futureDubaiOffsetIso(followUpLocal, now);
  }
  return payload;
}

export function consultOutcomeErrorMessage(error, payload) {
  const code = String(error || "");
  const noteErrors = payload?.details?.fieldErrors?.note || [];
  if (code === "Enter a clinical note." || noteErrors.length) return "Enter a clinical note.";
  const followUpErrors = payload?.details?.fieldErrors?.follow_up_at || [];
  if (followUpErrors.includes("follow_up_at_required")) return "Choose a follow-up date and time.";
  if (followUpErrors.includes("follow_up_at_must_be_future")) return "Choose a future follow-up time in Dubai.";
  if (code === "existing_treatment_plan_not_found") {
    return "No active treatment plan is available to continue. Choose another outcome.";
  }
  if (code.endsWith("_consultation_not_completed")) {
    return "Complete the consultation before recording its outcome.";
  }
  if (code.endsWith("_consultation_doctor_mismatch") || code === "clinical_doctor_mismatch") {
    return "This consultation is assigned to another doctor. Nothing was changed.";
  }
  if (code === "appointment_not_found") return "This consultation is no longer available. Refresh and try again.";
  return "Could not record this outcome. Nothing was changed.";
}
