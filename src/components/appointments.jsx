import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { authFetch, fetchJson } from "../lib/authFetch.js";

/* global React */
const { useEffect: useEffectA, useMemo: useMemoA, useState: useStateA } = React;

function dubaiToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatScreenDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatSectionDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function addDays(date, amount) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + amount));
  return next.toISOString().slice(0, 10);
}

function isCompletable(status) {
  return !["completed", "cancelled", "canceled", "no_show"].includes(String(status || "").toLowerCase());
}

function isClosedStatus(status) {
  return ["completed", "cancelled", "canceled", "no_show"].includes(String(status || "").toLowerCase());
}

function isCompletedStatus(status) {
  return String(status || "").toLowerCase() === "completed";
}

function blocksQuickWlpPrescription(status) {
  return ["cancelled", "canceled", "no_show"].includes(String(status || "").toLowerCase());
}

function toTitle(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(minutes) {
  if (!minutes) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  }).format(new Date(value));
}

function formatAedFromFils(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return `AED ${(amount / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function medicationOrderState(appointment) {
  const prescription = appointment?.workbench?.prescription || {};
  const fulfillment = appointment?.workbench?.fulfillment || {};
  const checkoutStatus = String(prescription.checkout_status || "").toUpperCase();
  if (fulfillment.delivered_at) return "Delivered";
  if (fulfillment.order_id && fulfillment.paid_at) return "Paid";
  if (fulfillment.order_id) return "Order created";
  if (prescription.status === "ISSUED") {
    if (checkoutStatus === "EXPIRED") return "Checkout expired";
    return "Payment pending";
  }
  return "Not started";
}

function medicationOrderAmount(appointment) {
  const prescription = appointment?.workbench?.prescription || {};
  const fulfillment = appointment?.workbench?.fulfillment || {};
  if (fulfillment.amount_fils) {
    return { label: "Paid amount", value: formatAedFromFils(fulfillment.amount_fils) };
  }
  if (prescription.amount_fils) {
    return { label: "Expected amount", value: formatAedFromFils(prescription.amount_fils) };
  }
  return { label: "Amount", value: "" };
}

function prescriptionIssued(appointment) {
  return appointment?.workbench?.prescription?.status === "ISSUED";
}

function consultationChecklist(appointment, nowMs) {
  const workbench = appointment?.workbench || {};
  const consultation = workbench.consultation || {};
  const prescription = workbench.prescription || {};
  const fulfillment = workbench.fulfillment || {};
  const normalized = String(appointment?.status || consultation.status || "").toLowerCase();
  const scheduled = Boolean(appointment?.time);
  const noShow = normalized === "no_show" || String(consultation.status || "").toLowerCase() === "no_show";
  const completed = Boolean(consultation.completed_at) || normalized === "completed";
  const issued = prescription.status === "ISSUED";
  const live = appointmentIsLiveNow(appointment, nowMs);
  const paid = Boolean(fulfillment.paid_at || fulfillment.order_id);
  const delivered = Boolean(fulfillment.delivered_at);

  const steps = [
    {
      label: "Consultation scheduled",
      meta: appointment?.time ? `${appointment.time} · ${appointment.duration || 0} min` : "",
      state: scheduled ? "done" : "pending"
    },
    {
      label: noShow ? "Marked no-show" : "Consultation completed",
      meta: noShow ? formatDateTime(consultation.no_show_at) : formatDateTime(consultation.completed_at),
      state: noShow ? "risk" : completed ? "done" : live ? "current" : "pending"
    },
    {
      label: issued ? "Prescription issued" : "Prescription not issued",
      meta: issued ? formatDateTime(prescription.issued_at) : completed ? "Ready for doctor decision" : "Waiting for consultation",
      state: issued ? "done" : completed ? "current" : "pending"
    },
    {
      label: "Issued but unpaid",
      meta: issued && !paid ? medicationOrderState(appointment) : paid ? "Payment received" : "No unpaid prescription",
      state: issued && !paid ? "current" : paid ? "done" : "pending"
    },
    {
      label: "Paid",
      meta: paid ? formatDateTime(fulfillment.paid_at) || "Paid" : "Not paid",
      state: paid ? "done" : issued ? "current" : "pending"
    },
    {
      label: "Delivered",
      meta: delivered ? formatDateTime(fulfillment.delivered_at) : paid ? "Awaiting delivery" : "Not delivered",
      state: delivered ? "done" : paid ? "current" : "pending"
    },
  ];

  if (delivered) {
    steps.push({
      label: "Follow-up/refill",
      meta: "Manage from Patient Hub",
      state: "pending"
    });
  }

  return steps;
}

function actionState(appointment, nowMs) {
  if (!appointment) {
    return {
      label: "",
      tone: "idle",
      canPrescribe: false,
      canComplete: false,
      canNoShow: false
    };
  }
  const normalized = String(appointment.status || "").toLowerCase();
  const issued = prescriptionIssued(appointment);
  const completed = isCompletedStatus(normalized);
  if (normalized === "no_show") {
    return {
      label: "No-show marked. Ops should follow up and rebook if the member still wants the consultation.",
      tone: "risk",
      canPrescribe: false,
      canComplete: false,
      canNoShow: false
    };
  }
  if (normalized === "cancelled" || normalized === "canceled") {
    return {
      label: "Cancelled. No doctor action required.",
      tone: "idle",
      canPrescribe: false,
      canComplete: false,
      canNoShow: false
    };
  }
  if (issued) {
    const fulfillment = appointment.workbench?.fulfillment || {};
    return {
      label: fulfillment.order_id && fulfillment.paid_at
        ? "Medication paid. No doctor action required here."
        : "Prescription issued. Payment is handled outside this view.",
      tone: fulfillment.order_id && fulfillment.paid_at ? "done" : "idle",
      canPrescribe: false,
      canComplete: false,
      canNoShow: false
    };
  }
  if (completed) {
    return {
      label: "Consultation completed. Issue prescription if clinically eligible.",
      tone: "current",
      canPrescribe: true,
      canComplete: false,
      canNoShow: false
    };
  }
  return {
    label: appointment.meetingLink
      ? appointmentOutcomeActionsAvailable(appointment, nowMs)
        ? "Join consultation, then complete or mark no-show."
        : "Join at the scheduled time. Outcome actions unlock when the slot starts."
      : "Review appointment and update outcome.",
    tone: "current",
    canPrescribe: false,
    canComplete: isCompletable(appointment.status),
    canNoShow: isCompletable(appointment.status)
  };
}

function humanizeStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "no_show") return "No show";
  if (normalized === "upcoming" || normalized === "booked") return "Upcoming";
  if (normalized === "completed") return "Completed";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  return toTitle(status || "Upcoming");
}

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "done";
  if (normalized === "no_show" || normalized === "cancelled" || normalized === "canceled") return "risk";
  return "active";
}

const APPOINTMENT_STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "needs_action", label: "Needs action" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "no_show", label: "No-show" },
];

function appointmentStatusBucket(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "completed") return "completed";
  if (normalized === "no_show") return "no_show";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  return "upcoming";
}

function appointmentIsLiveNow(appointment, nowMs) {
  if (appointmentStatusBucket(appointment?.status) !== "upcoming") return false;
  const startMs = new Date(appointment?.scheduledStartAt || "").getTime();
  const endMs = new Date(appointment?.scheduledEndAt || "").getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
  return nowMs >= startMs && nowMs <= endMs;
}

function appointmentOutcomeActionsAvailable(appointment, nowMs) {
  if (appointmentStatusBucket(appointment?.status) !== "upcoming") return false;
  const startMs = new Date(appointment?.scheduledStartAt || "").getTime();
  if (!Number.isFinite(startMs)) return true;
  return nowMs >= startMs;
}

function appointmentNeedsAction(appointment, nowMs) {
  if (!appointment) return false;
  const bucket = appointmentStatusBucket(appointment.status);
  if (bucket === "no_show") return true;
  if (bucket === "upcoming") return appointmentIsLiveNow(appointment, nowMs);
  if (bucket !== "completed") return false;
  return !prescriptionIssued(appointment);
}

function nextStepLabel(appointment) {
  if (!appointment) return "";
  const normalized = String(appointment.status || "").toLowerCase();
  const workbench = appointment.workbench || {};
  const prescription = workbench.prescription || {};
  const fulfillment = workbench.fulfillment || {};
  if (fulfillment.delivered_at) return "Medication delivered";
  if (fulfillment.order_id && !fulfillment.delivered_at) return "Medication paid, delivery pending";
  if (prescription.status === "ISSUED" && !fulfillment.order_id) return medicationOrderState(appointment);
  if (normalized === "completed") return appointment.source === "quickwlp" ? "Issue prescription if clinically eligible" : "Open chart or message member";
  if (normalized === "no_show") return "Follow up and rebook if needed";
  if (normalized === "cancelled" || normalized === "canceled") return "No doctor action required";
  if (appointment.meetingLink) return "Join consultation, then complete or mark no-show";
  return "Review appointment and update outcome";
}

function appointmentRowContext(appointment) {
  return [appointmentContextLabel(appointment), appointment.service].filter(Boolean).join(" · ");
}

function appointmentRowTime(appointment, selectedDate) {
  if (!appointment?.date || appointment.date === selectedDate) return appointment?.time || "";
  const [, month, day] = String(appointment.date).split("-");
  return `${Number(day)}/${Number(month)} · ${appointment.time}`;
}

function sourceTagLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "JUSTLIFE") return "Justlife";
  if (normalized === "NOVO_NORDISK") return "Novo Nordisk";
  if (normalized === "REGULAR") return "Regular";
  return toTitle(normalized);
}

function appointmentContextLabel(appointment) {
  if (appointment.source === "quickwlp") {
    const track = appointment.trackKey === "peptides" ? "Peptides" : "Weight Loss";
    return ["Quick Consult", track, appointment.sourceTag ? sourceTagLabel(appointment.sourceTag) : ""].filter(Boolean).join(" · ");
  }
  const track = appointment.trackKey === "weight-loss" ? "Weight Loss" : toTitle(appointment.trackKey || "Rx");
  return `${track} · Rx`;
}

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="workbench-info-row">
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

function WorkbenchMetric({ label, value, tone = "" }) {
  return (
    <div className={`workbench-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

function WorkbenchItems({ items }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return <div className="workbench-empty">No medication items yet.</div>;
  return (
    <div className="workbench-item-list">
      {list.map((item, index) => (
        <div key={`${item.name}-${index}`} className="workbench-item-row">
          <div>
            <strong>{item.name || "Medication"}</strong>
            {item.instructions && <span>{item.instructions}</span>}
          </div>
          <em>Qty {item.quantity || 1}</em>
        </div>
      ))}
    </div>
  );
}

function ConsultationHistory({ history, loading, currentId }) {
  const list = Array.isArray(history) ? history.filter((item) => item.id !== currentId).slice(0, 4) : [];
  if (loading) return <div className="workbench-empty">Loading consultation history...</div>;
  if (!list.length) return <div className="workbench-empty">No previous consultations found.</div>;
  return (
    <div className="workbench-history-list">
      {list.map((item) => (
        <div key={item.id || `${item.title}-${item.date}`} className="workbench-history-row">
          <div>
            <strong>{item.title || "Consultation"}</strong>
            {item.note && <span>{item.note}</span>}
          </div>
          <em>{formatDateTime(item.date)}</em>
        </div>
      ))}
    </div>
  );
}

function itemNames(items) {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((item) => {
      const quantity = Number(item.quantity || 1);
      return `${item.name || "Medication"}${quantity > 1 ? ` x${quantity}` : ""}`;
    })
    .filter(Boolean)
    .join(" · ");
}

function HistoryRows({ rows, emptyText, renderTitle, renderMeta }) {
  const list = Array.isArray(rows) ? rows.slice(0, 4) : [];
  if (!list.length) return <div className="workbench-empty">{emptyText}</div>;
  return (
    <div className="workbench-history-list">
      {list.map((item, index) => (
        <div key={item.id || item.order_id || `${renderTitle(item)}-${index}`} className="workbench-history-row">
          <div>
            <strong>{renderTitle(item)}</strong>
            <span>{renderMeta(item)}</span>
          </div>
          <em>{formatDateTime(item.issued_at || item.delivered_at || item.submitted_at || item.date)}</em>
        </div>
      ))}
    </div>
  );
}

function OperationalChecklist({ appointment, nowMs }) {
  return (
    <div className="rx-lifecycle-strip workbench-lifecycle-strip">
      {consultationChecklist(appointment, nowMs).map((step) => (
        <div key={step.label} className={`rx-lifecycle-step ${step.state}`}>
          <span className="workbench-check-dot" />
          <div>
            <strong>{step.label}</strong>
            <em>{step.meta || (step.state === "pending" ? "Pending" : "In progress")}</em>
          </div>
        </div>
      ))}
    </div>
  );
}

function mapAppointment(item) {
  const patient = item.patient || {};
  return {
    id: item.id,
    source: item.source || "rx",
    quickWlpLeadId: item.quickwlp_lead_id,
    patientId: item.patient_id,
    time: item.time,
    duration: item.duration_minutes,
    service: item.service_name,
    type: item.visit_type === "video" ? "Video call" : toTitle(item.visit_type),
    location: item.location_label,
    status: item.status,
    patient: {
      id: patient.id || item.patient_id,
      name: patient.name || "Unknown patient",
      initials: patient.initials || "P",
      age: patient.age,
      sex: toTitle(patient.sex),
      phone: patient.phone,
      email: patient.email,
      whatsapp: patient.whatsapp,
      chat: patient.chat || item.chat || { available: false, unavailable_reason: "chat_locked" },
    },
    chat: item.chat || patient.chat || { available: false, unavailable_reason: "chat_locked" },
    date: item.date,
    scheduledStartAt: item.scheduled_start_at,
    scheduledEndAt: item.scheduled_end_at,
    meetingLink: item.meeting_link,
    trackKey: item.track_key,
    sourceTag: item.source_tag,
    doctorId: item.doctor_id,
    workbench: item.workbench || null,
  };
}

function AppointmentsView({ onOpenPatient, onOpenChat, onPrescribeRx, onPrescribeQuickWlp }) {
  const { I, Avatar, Topbar } = window.DD_UI;
  const PatientChatDrawer = window.DD_PatientChatDrawer;
  const PatientChart = window.DD_PatientChart;
  const currentDate = useMemoA(() => dubaiToday(), []);
  const [selectedDate, setSelectedDate] = useStateA(currentDate);
  const [today, setToday] = useStateA([]);
  const [week, setWeek] = useStateA([]);
  const [selectedId, setSelectedId] = useStateA(null);
  const [loading, setLoading] = useStateA(true);
  const [error, setError] = useStateA("");
  const [joiningId, setJoiningId] = useStateA(null);
  const [callingId, setCallingId] = useStateA(null);
  const [callConfirm, setCallConfirm] = useStateA(null);
  const [completingId, setCompletingId] = useStateA(null);
  const [completeConfirm, setCompleteConfirm] = useStateA(null);
  const [noShowingId, setNoShowingId] = useStateA(null);
  const [noShowConfirm, setNoShowConfirm] = useStateA(null);
  const [patientProfiles, setPatientProfiles] = useStateA([]);
  const [profilesLoading, setProfilesLoading] = useStateA(false);
  const [profilesLoaded, setProfilesLoaded] = useStateA(false);
  const [callToast, setCallToast] = useStateA("");
  const [statusFilter, setStatusFilter] = useStateA("all");
  const [scheduleScope, setScheduleScope] = useStateA("day");
  const [nowMs, setNowMs] = useStateA(() => Date.now());
  const [chatTarget, setChatTarget] = useStateA(null);

  const loadAppointments = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson(`${API_BASE}/doctor/dashboard/appointments?date=${selectedDate}&doctor_id=${encodeURIComponent(DOCTOR_ID)}`);
      const nextToday = (data.today || []).map(mapAppointment).sort((a, b) => a.time.localeCompare(b.time));
      const nextWeek = (data.week || []).map(mapAppointment).sort((a, b) => {
        const dateCompare = String(a.date).localeCompare(String(b.date));
        return dateCompare || a.time.localeCompare(b.time);
      });

      setToday(nextToday);
      setWeek(nextWeek);
      setSelectedId((current) => {
        const all = [...nextToday, ...nextWeek];
        if (current && all.some((appointment) => appointment.id === current)) return current;
        return nextToday.find((appointment) => appointment.status === "upcoming")?.id || nextToday[0]?.id || nextWeek[0]?.id || null;
      });
    } catch {
      setError("Could not load appointments from the dev API.");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffectA(() => {
    loadAppointments();
  }, [loadAppointments]);

  const loadPatientProfiles = React.useCallback(async () => {
    if (profilesLoaded || profilesLoading) return;
    setProfilesLoading(true);
    try {
      const data = await fetchJson(`${API_BASE}/doctor/dashboard/patients?doctor_id=${DOCTOR_ID}`);
      setPatientProfiles(Array.isArray(data.patients) ? data.patients : []);
      setProfilesLoaded(true);
    } catch {
      setPatientProfiles([]);
      setProfilesLoaded(true);
    } finally {
      setProfilesLoading(false);
    }
  }, [profilesLoaded, profilesLoading]);

  const allAppointments = useMemoA(() => [...today, ...week], [today, week]);
  const selected = allAppointments.find((appointment) => appointment.id === selectedId) || null;
  const selectedPatient = selected?.patient || null;
  const selectedIsQuickWlp = selected?.source === "quickwlp";
  const selectedWorkbench = selected?.workbench || null;
  const selectedAssessment = selectedWorkbench?.assessment || {};
  const selectedPrescription = selectedWorkbench?.prescription || {};
  const selectedFulfillment = selectedWorkbench?.fulfillment || {};
  const selectedMedicationAmount = medicationOrderAmount(selected);
  const selectedPrescriptionIssued = selectedPrescription.status === "ISSUED";
  const selectedPrescriptionItems = Array.isArray(selectedPrescription.items) ? selectedPrescription.items : [];
  const hasMedicationOrderDetails = Boolean(
    selectedPrescriptionIssued ||
    selectedFulfillment.status ||
    selectedFulfillment.order_id ||
    selectedFulfillment.paid_at ||
    selectedFulfillment.delivered_at ||
    selectedFulfillment.amount_fils
  );
  const selectedActionState = actionState(selected, nowMs);
  const selectedHasPatientChart = Boolean(selectedPatient?.id && (!selectedIsQuickWlp || selectedPatient.id !== selected.quickWlpLeadId));
  const selectedProfile = selected
    ? patientProfiles.find((profile) => profile.id === selected.patientId || profile.id === selectedPatient?.id)
    : null;
  const selectedHistory = selectedProfile?.visit_history || [];
  const selectedOutcomeUnlocked = selected ? appointmentOutcomeActionsAvailable(selected, nowMs) : false;
  const canCompleteSelected = selectedActionState.canComplete && selectedOutcomeUnlocked;
  const canNoShowSelected = selectedActionState.canNoShow && selectedOutcomeUnlocked;
  const canPrescribeSelectedRx = selected && !selectedIsQuickWlp && selectedActionState.canPrescribe;
  const canPrescribeSelectedQuickWlp = selectedIsQuickWlp && selectedActionState.canPrescribe && !blocksQuickWlpPrescription(selected.status);
  const selectedHasJoinOrCall = Boolean(selected?.meetingLink && appointmentStatusBucket(selected.status) === "upcoming");
  const selectedHasClinicalActions = Boolean(
    selectedHasJoinOrCall ||
    canCompleteSelected ||
    canNoShowSelected ||
    canPrescribeSelectedRx ||
    canPrescribeSelectedQuickWlp
  );
  const selectedHasLockedOutcomeNote = Boolean(
    selectedActionState.canComplete &&
    !selectedOutcomeUnlocked &&
    appointmentStatusBucket(selected?.status) === "upcoming"
  );
  const selectedConsultationHistoryRows = Array.isArray(selectedHistory)
    ? selectedHistory.filter((item) => item.id !== selected?.id)
    : [];
  const selectedPrescriptionHistoryRows = Array.isArray(selectedProfile?.rx_prescription_history) ? selectedProfile.rx_prescription_history : [];
  const selectedDeliveredMedicationRows = Array.isArray(selectedProfile?.delivered_medications) ? selectedProfile.delivered_medications : [];
  const selectedRefillHistoryRows = Array.isArray(selectedProfile?.refill_history) ? selectedProfile.refill_history : [];
  const selectedMemberLabel = selectedPatient
    ? [selectedPatient.age ? `${selectedPatient.age}y` : "", selectedPatient.sex && selectedPatient.sex !== "Unknown" ? selectedPatient.sex : ""].filter(Boolean).join(" · ")
    : "";
  const selectedHeightWeight = [
    selectedAssessment.height_cm ? `${selectedAssessment.height_cm} cm` : "",
    selectedAssessment.weight_kg ? `${selectedAssessment.weight_kg} kg` : "",
  ].filter(Boolean).join(" · ");
  const selectedAllergies = (selectedAssessment.allergies || []).join(", ");
  const selectedConditions = (selectedAssessment.conditions || []).join(", ");
  const hasClinicalSummary = Boolean(
    (selectedIsQuickWlp && selectedAssessment.preferred_medication) ||
    selectedHeightWeight ||
    selectedAssessment.bmi ||
    selectedAllergies ||
    selectedConditions ||
    selectedAssessment.latest_submitted_at
  );
  const scheduleAppointments = useMemoA(() => (
    scheduleScope === "week" ? allAppointments : today
  ), [allAppointments, scheduleScope, today]);
  const statusCounts = useMemoA(() => {
    return scheduleAppointments.reduce((counts, appointment) => {
      const bucket = appointmentStatusBucket(appointment.status);
      counts.all += 1;
      if (appointmentNeedsAction(appointment, nowMs)) counts.needs_action += 1;
      if (bucket === "upcoming" || bucket === "completed" || bucket === "no_show") {
        counts[bucket] += 1;
      }
      return counts;
    }, { all: 0, needs_action: 0, upcoming: 0, completed: 0, no_show: 0 });
  }, [nowMs, scheduleAppointments]);
  const visibleAppointments = useMemoA(() => {
    if (statusFilter === "all") return scheduleAppointments;
    if (statusFilter === "needs_action") return scheduleAppointments.filter((appointment) => appointmentNeedsAction(appointment, nowMs));
    return scheduleAppointments.filter((appointment) => appointmentStatusBucket(appointment.status) === statusFilter);
  }, [nowMs, scheduleAppointments, statusFilter]);
  const activeFilterLabel = APPOINTMENT_STATUS_FILTERS.find((filter) => filter.key === statusFilter)?.label || "appointments";
  const upcomingCount = statusCounts.upcoming;
  const activeAppointmentId = visibleAppointments.find((appointment) => appointmentIsLiveNow(appointment, nowMs))?.id || null;
  const dateStr = formatScreenDate(selectedDate);
  const sectionDate = formatSectionDate(selectedDate);
  const isToday = selectedDate === currentDate;
  const isTomorrow = selectedDate === addDays(currentDate, 1);
  const scheduleTitle = scheduleScope === "week" ? "Upcoming schedule" : isToday ? "Today" : isTomorrow ? "Tomorrow" : "Selected day";
  const scheduleSubtitle = scheduleScope === "week" ? `${sectionDate} + 7 days` : dateStr;

  useEffectA(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffectA(() => {
    if (selected) loadPatientProfiles();
  }, [loadPatientProfiles, selected?.id]);

  useEffectA(() => {
    if (!visibleAppointments.length) return;
    if (visibleAppointments.some((appointment) => appointment.id === selectedId)) return;
    setSelectedId(visibleAppointments[0].id);
  }, [selectedId, visibleAppointments]);

  const joinAppointment = async (appointment, event) => {
    event.stopPropagation();
    setJoiningId(appointment.id);
    try {
      const response = await authFetch(`${API_BASE}/doctor/appointments/${appointment.id}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok || !data.session_url) throw new Error(data.error || data.status || "session_unavailable");
      window.open(data.session_url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Could not open the appointment session.");
    } finally {
      setJoiningId(null);
    }
  };
  const callPatient = async () => {
    if (!callConfirm) return;
    const appointment = callConfirm;
    setCallingId(appointment.id);
    setCallConfirm(null);
    setError("");
    try {
      const response = await authFetch(`${API_BASE}/doctor/appointments/${appointment.id}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: DOCTOR_ID }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "call_failed");
      setCallToast(`Calling ${appointment.patient.name}`);
      setTimeout(() => setCallToast(""), 2400);
    } catch {
      setError("Could not call the patient for this appointment.");
    } finally {
      setCallingId(null);
    }
  };
  const completeConsultation = async () => {
    if (!completeConfirm) return;
    const appointment = completeConfirm;
    setCompletingId(appointment.id);
    setCompleteConfirm(null);
    setError("");
    try {
      const response = await authFetch(`${API_BASE}/doctor/appointments/${appointment.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: DOCTOR_ID,
          completion_notes_json: {
            note: "Consultation completed from doctor dashboard.",
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "complete_failed");
      setCallToast(`Completed ${appointment.patient.name}'s consultation`);
      setTimeout(() => setCallToast(""), 2400);
      await loadAppointments();
    } catch {
      setError("Could not complete this consultation.");
    } finally {
      setCompletingId(null);
    }
  };
  const markNoShow = async () => {
    if (!noShowConfirm) return;
    const appointment = noShowConfirm;
    setNoShowingId(appointment.id);
    setNoShowConfirm(null);
    setError("");
    try {
      const response = await authFetch(
        appointment.source === "quickwlp"
          ? `${API_BASE}/doctor/quickwlp/requests/${encodeURIComponent(appointment.quickWlpLeadId || appointment.patientId)}/finalize`
          : `${API_BASE}/doctor/appointments/${appointment.id}/no-show`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            appointment.source === "quickwlp"
              ? { doctor_id: DOCTOR_ID, value: "No show" }
              : {
                  doctor_id: DOCTOR_ID,
                  completion_notes_json: {
                    note: "Marked no-show from doctor dashboard.",
                  },
                }
          ),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "no_show_failed");
      setCallToast(`Marked ${appointment.patient.name} as no-show`);
      setTimeout(() => setCallToast(""), 2400);
      await loadAppointments();
    } catch {
      setError("Could not mark this consultation as no-show.");
    } finally {
      setNoShowingId(null);
    }
  };

  return (
    <>
      <Topbar
        title="Schedule"
        subtitle={scheduleSubtitle}
      />
      <div className="apt-layout">
        <div className="apt-main dd-scroll">
          <div className="today-stat-row">
            <div className="stat"><div className="v">{loading ? "..." : scheduleAppointments.length}</div><div className="l">{scheduleScope === "week" ? "Next 7 days" : "Appointments"}</div></div>
            <div className="stat"><div className="v">{loading ? "..." : upcomingCount}</div><div className="l">Upcoming</div></div>
            <div className="stat"><div className="v">{loading ? "..." : statusCounts.needs_action}</div><div className="l">Needs action</div></div>
          </div>

          <div className="section-hdr">
            <div>
              <div className="label apt-date-label">{scheduleTitle}</div>
              <div className="apt-date-subtitle">{scheduleScope === "week" ? "Consultations from the selected day onward" : sectionDate}</div>
            </div>
            <div className="apt-date-actions" aria-label="Appointment date navigation">
              <button type="button" className="btn-icon" onClick={() => setSelectedDate((date) => addDays(date, -1))} aria-label="Previous day" title="Previous day">
                {I.chevronLeft}
              </button>
              <button type="button" className={`apt-today-button ${isToday && scheduleScope === "day" ? "active" : ""}`} onClick={() => { setScheduleScope("day"); setSelectedDate(currentDate); }}>
                Today
              </button>
              <button type="button" className={`apt-today-button ${isTomorrow && scheduleScope === "day" ? "active" : ""}`} onClick={() => { setScheduleScope("day"); setSelectedDate(addDays(currentDate, 1)); }}>
                Tomorrow
              </button>
              <button type="button" className={`apt-today-button ${scheduleScope === "week" ? "active" : ""}`} onClick={() => setScheduleScope("week")}>
                Week
              </button>
              <input
                className="apt-date-input"
                type="date"
                value={selectedDate}
                onChange={(event) => {
                  if (event.target.value) {
                    setScheduleScope("day");
                    setSelectedDate(event.target.value);
                  }
                }}
                aria-label="Select schedule date"
              />
              <button type="button" className="btn-icon" onClick={() => setSelectedDate((date) => addDays(date, 1))} aria-label="Next day" title="Next day">
                {I.chevronRight}
              </button>
            </div>
          </div>

          <div className="apt-status-filters" aria-label="Appointment status filters">
            {APPOINTMENT_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`apt-filter-chip ${statusFilter === filter.key ? "active" : ""} ${filter.key}`}
                onClick={() => setStatusFilter(filter.key)}
              >
                <span>{filter.label}</span>
                <strong>{loading ? "..." : statusCounts[filter.key]}</strong>
              </button>
            ))}
          </div>

          {error && (
            <div className="api-state">
              <span>{error}</span>
              <button type="button" className="btn-ghost" onClick={loadAppointments}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="apt-loading">
              <div />
              <div />
              <div />
            </div>
          ) : scheduleAppointments.length === 0 ? (
            <div className="empty-state apt-empty">No consultations scheduled for this {scheduleScope === "week" ? "window" : "date"}</div>
          ) : visibleAppointments.length === 0 ? (
            <div className="empty-state apt-empty">No {activeFilterLabel.toLowerCase()} consultations for this {scheduleScope === "week" ? "window" : "date"}</div>
          ) : (
            <div className="timeline">
              {visibleAppointments.map((a) => {
                const isNow = a.id === activeAppointmentId;
                const isSel = a.id === selectedId;
                return (
                  <div key={a.id} className={"tl-row" + (isNow ? " now" : "")}>
                    <div className="time">{appointmentRowTime(a, selectedDate)}</div>
                    <div className="dot-mark"></div>
                    <div className={"apt-card" + (isSel ? " selected" : "") + (isNow && !isSel ? " now-card" : "")}
                         onClick={() => setSelectedId(a.id)}>
                      <div className="apt-row-main">
                        <div className="apt-row-primary">
                          <div className="apt-name">{a.patient.name}</div>
                          <span className={`apt-status apt-row-chip ${statusTone(a.status)}`}>{humanizeStatus(a.status)}</span>
                        </div>
                        <div className="apt-row-secondary">
                          <div className="apt-meta">
                            {a.patient.phone && <span>{a.patient.phone}</span>}
                            {a.patient.phone && <span className="dot-sep" />}
                            <span>{appointmentRowContext(a)}</span>
                          </div>
                          <div className="apt-actions">
                            {a.meetingLink && a.status === "upcoming" && (
                              <button className="btn-ghost apt-join-btn" onClick={(event) => joinAppointment(a, event)} disabled={joiningId === a.id}>
                                {I.video}<span>{joiningId === a.id ? "Opening" : "Join"}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="apt-side dd-scroll">
          {loading ? (
            <div className="empty-state">Loading appointments...</div>
          ) : selected && selectedPatient ? (
            <div className="consult-workbench fade-in" key={selected.id}>
              <div className="workbench-head">
                <Avatar initials={selectedPatient.initials} name={selectedPatient.name} size="lg" />
                <div className="workbench-identity">
                  <div className="workbench-name">{selectedPatient.name}</div>
                  <div className="workbench-meta">
                    {[selectedPatient.phone, selectedPatient.email].filter(Boolean).join(" · ") || "Contact not provided"}
                  </div>
                </div>
                <span className={`workbench-status ${statusTone(selected.status)}`}>{humanizeStatus(selected.status)}</span>
              </div>

              <div className={`workbench-overview${hasMedicationOrderDetails ? "" : " compact"}`}>
                <WorkbenchMetric label="Slot" value={`${selected.time} · ${selected.duration} min`} />
                <WorkbenchMetric label="Source" value={selectedIsQuickWlp ? "Quick Consult" : "Lifestyle Rx"} />
                <WorkbenchMetric label="Track" value={selected.trackKey === "weight-loss" ? "Weight Loss" : toTitle(selected.trackKey || "Rx")} />
                {hasMedicationOrderDetails && (
                  <WorkbenchMetric label="Order" value={medicationOrderState(selected)} tone={selectedFulfillment.delivered_at ? "done" : selectedPrescription.status === "ISSUED" ? "current" : ""} />
                )}
              </div>

              <div className={`workbench-next ${selectedActionState.tone}`}>
                <span>Next action</span>
                <strong>{selectedActionState.label || nextStepLabel(selected)}</strong>
              </div>

              {(selectedHasClinicalActions || selectedHasLockedOutcomeNote) && (
                <section className="workbench-section workbench-section-actions">
                  <div className="workbench-section-title">Actions</div>
                  <div className="workbench-actions">
                    {selected.meetingLink && appointmentStatusBucket(selected.status) === "upcoming" && (
                      <>
                        <button className="workbench-action-button primary" onClick={(event) => joinAppointment(selected, event)} disabled={joiningId === selected.id}>
                          {I.video}<span>{joiningId === selected.id ? "Opening session..." : "Join video consultation"}</span>
                        </button>
                        <button
                          className="workbench-action-button secondary"
                          onClick={() => setCallConfirm(selected)}
                          disabled={callingId === selected.id}
                        >
                          {I.phone}<span>{callingId === selected.id ? "Calling..." : "Call Patient"}</span>
                        </button>
                      </>
                    )}
                    {canCompleteSelected && (
                      <button
                        className="workbench-action-button secondary"
                        onClick={() => setCompleteConfirm(selected)}
                        disabled={completingId === selected.id}
                      >
                        {I.check}<span>{completingId === selected.id ? "Completing..." : "Complete Consultation"}</span>
                      </button>
                    )}
                    {canNoShowSelected && (
                      <button
                        className="workbench-action-button danger"
                        onClick={() => setNoShowConfirm(selected)}
                        disabled={noShowingId === selected.id}
                      >
                        {I.warn}<span>{noShowingId === selected.id ? "Saving..." : "Mark No-show"}</span>
                      </button>
                    )}
                    {canPrescribeSelectedQuickWlp && (
                      <button className="workbench-action-button primary" onClick={() => onPrescribeQuickWlp?.(selected)}>
                        {I.pill}<span>Issue prescription</span>
                      </button>
                    )}
                    {canPrescribeSelectedRx && (
                      <button className="workbench-action-button primary" onClick={() => onPrescribeRx?.(selected)}>
                        {I.pill}<span>Issue prescription</span>
                      </button>
                    )}
                    {selectedHasLockedOutcomeNote && (
                      <div className="workbench-note">Outcome actions unlock when the scheduled slot starts.</div>
                    )}
                  </div>
                </section>
              )}

              {(selectedHasPatientChart || selectedIsQuickWlp) && (
                <section className="workbench-section workbench-section-access">
                  <div className="workbench-section-title">Patient access</div>
                  <div className="workbench-access-actions">
                    {selectedHasPatientChart ? (
                      <button className="workbench-action-button secondary" onClick={() => onOpenPatient(selectedPatient.id)}>Open patient chart</button>
                    ) : null}
                    {selectedIsQuickWlp ? (
                      <div className="workbench-note">Quick Consult does not include in-app chat. Use phone or WhatsApp for follow-up.</div>
                    ) : selected.chat?.available ? (
                      <button
                        className="workbench-action-button secondary"
                        onClick={() => setChatTarget({
                          patientId: selectedPatient.id,
                          patientName: selectedPatient.name,
                        })}
                      >
                        {I.message}<span>Message {selectedPatient.name.split(" ")[0]}</span>
                      </button>
                    ) : (
                      <div className="workbench-note">Chat unlocks after consultation completion.</div>
                    )}
                    {selectedIsQuickWlp && !selectedHasPatientChart ? (
                      <div className="workbench-note">Patient chart is not linked yet for this older Quick Consult.</div>
                    ) : null}
                  </div>
                </section>
              )}

              {PatientChart && selectedHasPatientChart ? (
                <section className="workbench-section workbench-patient-chart">
                  <div className="workbench-section-title">Clinical context</div>
                  <PatientChart
                    patientId={selectedPatient.id}
                    mode="appointment"
                    focus="schedule"
                    context={{ appointment: selected, label: "Schedule" }}
                    onOpenPatient={onOpenPatient}
                    onMessage={selectedIsQuickWlp ? undefined : (id) => setChatTarget({ patientId: id || selectedPatient.id, patientName: selectedPatient.name })}
                    onPrescribe={({ patientId, trackKey, mode }) => onPrescribeRx?.({ ...selected, patientId, trackKey, prescriptionMode: mode })}
                  />
                </section>
              ) : (
                <>
                  <section className="workbench-section">
                    <div className="workbench-section-title">Prescription lifecycle</div>
                    <OperationalChecklist appointment={selected} nowMs={nowMs} />
                  </section>

                  <section className="workbench-section">
                    <div className="workbench-section-title">Visit details</div>
                    <InfoRow label="Service" value={selected.service} />
                    <InfoRow label="Mode" value={selected.type} />
                    <InfoRow label="Member" value={selectedMemberLabel} />
                    {selectedPatient.whatsapp && <InfoRow label="WhatsApp" value={selectedPatient.whatsapp} />}
                  </section>

                  {hasClinicalSummary && (
                <section className="workbench-section">
                  <div className="workbench-section-title">Clinical summary</div>
                  {selectedIsQuickWlp && <InfoRow label="Preferred" value={selectedAssessment.preferred_medication} />}
                  <InfoRow label="Height / weight" value={selectedHeightWeight} />
                  <InfoRow label="BMI" value={selectedAssessment.bmi} />
                  <InfoRow label="Allergies" value={selectedAllergies} />
                  <InfoRow label="Conditions" value={selectedConditions} />
                  <InfoRow label="Assessment" value={formatDateTime(selectedAssessment.latest_submitted_at)} />
                </section>
                  )}

                  {selectedPrescriptionIssued && (
                <section className="workbench-section">
                  <div className="workbench-section-title">Prescription</div>
                  <InfoRow label="Status" value="Issued" />
                  {selectedPrescription.issued_at && <InfoRow label="Issued" value={formatDateTime(selectedPrescription.issued_at)} />}
                </section>
                  )}

                  {hasMedicationOrderDetails && (
                <section className="workbench-section">
                  <div className="workbench-section-title">Medication order</div>
                  <InfoRow label="Status" value={medicationOrderState(selected)} />
                  {selectedMedicationAmount.value && <InfoRow label={selectedMedicationAmount.label} value={selectedMedicationAmount.value} />}
                  {selectedFulfillment.order_id && <InfoRow label="Shipment" value={selectedFulfillment.order_id} />}
                  {selectedFulfillment.delivered_at && <InfoRow label="Delivered" value={formatDateTime(selectedFulfillment.delivered_at)} />}
                  {selectedPrescriptionItems.length > 0 && <WorkbenchItems items={selectedPrescriptionItems} />}
                </section>
                  )}

                  {!selectedIsQuickWlp && ((profilesLoading && !profilesLoaded) || selectedConsultationHistoryRows.length > 0) && (
                <section className="workbench-section">
                  <div className="workbench-section-title">Consultation history</div>
                  <ConsultationHistory history={selectedHistory} loading={profilesLoading && !profilesLoaded} currentId={selected.id} />
                </section>
                  )}

                  {!selectedIsQuickWlp && selectedPrescriptionHistoryRows.length > 0 && (
                <section className="workbench-section">
                  <div className="workbench-section-title">Prescription history</div>
                  <HistoryRows
                    rows={selectedProfile?.rx_prescription_history}
                    emptyText="No prior RX prescriptions found."
                    renderTitle={(item) => item.title || (item.track_key === "weight-loss" ? "Weight Loss Rx plan" : "Peptide Protocol plan")}
                    renderMeta={(item) => [
                      toTitle(item.status || "Issued"),
                      itemNames(item.items),
                      formatAedFromFils(item.amount_fils)
                    ].filter(Boolean).join(" · ")}
                  />
                </section>
                  )}

                  {!selectedIsQuickWlp && selectedDeliveredMedicationRows.length > 0 && (
                <section className="workbench-section">
                  <div className="workbench-section-title">Delivered medication</div>
                  <HistoryRows
                    rows={selectedProfile?.delivered_medications}
                    emptyText="No delivered medication orders found."
                    renderTitle={(item) => itemNames(item.items) || item.order_id || "Delivered medication"}
                    renderMeta={(item) => [
                      item.order_id,
                      formatAedFromFils(item.amount_fils),
                      item.paid_at ? `Paid ${formatDateTime(item.paid_at)}` : ""
                    ].filter(Boolean).join(" · ")}
                  />
                </section>
                  )}

                  {!selectedIsQuickWlp && selectedRefillHistoryRows.length > 0 && (
                <section className="workbench-section">
                  <div className="workbench-section-title">Refill history</div>
                  <HistoryRows
                    rows={selectedProfile?.refill_history}
                    emptyText="No refill requests found."
                    renderTitle={(item) => toTitle(item.status || "Refill request")}
                    renderMeta={(item) => [
                      item.dosage_adjustment ? toTitle(item.dosage_adjustment) : "",
                      item.side_effects ? `Side effects: ${toTitle(item.side_effects)}` : "",
                      item.reviewed_at ? `Reviewed ${formatDateTime(item.reviewed_at)}` : ""
                    ].filter(Boolean).join(" · ")}
                  />
                </section>
                  )}
                </>
              )}

            </div>
          ) : <div className="empty-state">Select an appointment</div>}
        </div>
      </div>
      {callConfirm && (
        <div className="confirm-backdrop" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="call-patient-title">
            <h2 id="call-patient-title">Call patient?</h2>
            <p>Make sure you have joined the meeting first before calling the patient.</p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setCallConfirm(null)}>Cancel</button>
              <button className="btn-primary" onClick={callPatient}>{I.phone}<span>Call Patient</span></button>
            </div>
          </div>
        </div>
      )}
      {completeConfirm && (
        <div className="confirm-backdrop" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="complete-consultation-title">
            <h2 id="complete-consultation-title">Complete consultation?</h2>
            <p>Only mark consultation as completed when you have finished the video call with the customer.</p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setCompleteConfirm(null)}>Cancel</button>
              <button className="btn-primary" onClick={completeConsultation}>{I.check}<span>Complete Consultation</span></button>
            </div>
          </div>
        </div>
      )}
      {noShowConfirm && (
        <div className="confirm-backdrop" role="presentation">
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="no-show-consultation-title">
            <h2 id="no-show-consultation-title">Mark no-show?</h2>
            <p>Use this only when the member did not attend the consultation. This reopens follow-up for the ops team.</p>
            <div className="confirm-actions">
              <button className="btn-ghost" onClick={() => setNoShowConfirm(null)}>Cancel</button>
              <button className="btn-primary" onClick={markNoShow}>{I.warn}<span>Mark No-show</span></button>
            </div>
          </div>
        </div>
      )}
      {callToast && (
        <div className="toast">
          {I.phone}<span>{callToast}</span>
        </div>
      )}
      {PatientChatDrawer && (
        <PatientChatDrawer
          open={Boolean(chatTarget)}
          patientId={chatTarget?.patientId || ""}
          patientName={chatTarget?.patientName || ""}
          onClose={() => setChatTarget(null)}
          onOpenPatient={(id, customerId) => {
            setChatTarget(null);
            onOpenPatient?.(id || chatTarget?.patientId, customerId);
          }}
        />
      )}
    </>
  );
}

window.DD_AppointmentsView = AppointmentsView;
