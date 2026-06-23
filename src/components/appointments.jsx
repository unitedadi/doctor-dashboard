import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";

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

function consultationChecklist(appointment) {
  const workbench = appointment?.workbench || {};
  const consultation = workbench.consultation || {};
  const prescription = workbench.prescription || {};
  const normalized = String(appointment?.status || consultation.status || "").toLowerCase();
  const scheduled = Boolean(appointment?.time);
  const noShow = normalized === "no_show" || String(consultation.status || "").toLowerCase() === "no_show";
  const completed = Boolean(consultation.completed_at) || normalized === "completed";
  const issued = prescription.status === "ISSUED";

  return [
    {
      label: "Consultation scheduled",
      meta: appointment?.time ? `${appointment.time} · ${appointment.duration || 0} min` : "",
      state: scheduled ? "done" : "pending"
    },
    {
      label: noShow ? "Marked no-show" : "Consultation completed",
      meta: noShow ? formatDateTime(consultation.no_show_at) : formatDateTime(consultation.completed_at),
      state: noShow ? "risk" : completed ? "done" : "current"
    },
    {
      label: "Prescription issued",
      meta: formatDateTime(prescription.issued_at),
      state: issued ? "done" : completed ? "current" : "pending"
    },
    {
      label: "Medication order",
      meta: medicationOrderState(appointment),
      state: workbench.fulfillment?.delivered_at ? "done" : issued ? "current" : "pending"
    }
  ];
}

function actionState(appointment) {
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
    return {
      label: "Prescription issued. Medication/payment state is read-only here.",
      tone: "done",
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
    label: appointment.meetingLink ? "Join consultation, then complete or mark no-show." : "Review appointment and update outcome.",
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

function sourceTagLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "JUSTLIFE") return "Justlife";
  if (normalized === "NOVO_NORDISK") return "Novo Nordisk";
  if (normalized === "REGULAR") return "Regular";
  return toTitle(normalized);
}

function appointmentContextLabel(appointment) {
  if (appointment.source === "quickwlp") {
    return ["Quick WLP", appointment.sourceTag ? sourceTagLabel(appointment.sourceTag) : ""].filter(Boolean).join(" · ");
  }
  const track = appointment.trackKey === "weight-loss" ? "Weight Loss" : toTitle(appointment.trackKey || "Rx");
  return `${track} · Rx`;
}

function InfoRow({ label, value }) {
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

function OperationalChecklist({ appointment }) {
  return (
    <div className="workbench-checklist">
      {consultationChecklist(appointment).map((step) => (
        <div key={step.label} className={`workbench-check-step ${step.state}`}>
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
    meetingLink: item.meeting_link,
    trackKey: item.track_key,
    sourceTag: item.source_tag,
    doctorId: item.doctor_id,
    workbench: item.workbench || null,
  };
}

function AppointmentsView({ onOpenPatient, onOpenChat, onPrescribeRx, onPrescribeQuickWlp }) {
  const { I, Avatar, Topbar } = window.DD_UI;
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

  const loadAppointments = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/doctor/dashboard/appointments?date=${selectedDate}&doctor_id=${encodeURIComponent(DOCTOR_ID)}`);
      if (!response.ok) throw new Error(`appointments_request_failed_${response.status}`);
      const data = await response.json();
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
      const response = await fetch(`${API_BASE}/doctor/dashboard/patients?doctor_id=${DOCTOR_ID}`);
      if (!response.ok) throw new Error(`patients_request_failed_${response.status}`);
      const data = await response.json();
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
  const selectedActionState = actionState(selected);
  const selectedProfile = selected && !selectedIsQuickWlp
    ? patientProfiles.find((profile) => profile.id === selected.patientId || profile.id === selectedPatient?.id)
    : null;
  const selectedHistory = selectedProfile?.visit_history || [];
  const canCompleteSelected = selectedActionState.canComplete;
  const canNoShowSelected = selectedActionState.canNoShow;
  const canPrescribeSelectedRx = selected && !selectedIsQuickWlp && selectedActionState.canPrescribe;
  const canPrescribeSelectedQuickWlp = selectedIsQuickWlp && selectedActionState.canPrescribe && !blocksQuickWlpPrescription(selected.status);
  const statusCounts = useMemoA(() => {
    return today.reduce((counts, appointment) => {
      const bucket = appointmentStatusBucket(appointment.status);
      counts.all += 1;
      if (bucket === "upcoming" || bucket === "completed" || bucket === "no_show") {
        counts[bucket] += 1;
      }
      return counts;
    }, { all: 0, upcoming: 0, completed: 0, no_show: 0 });
  }, [today]);
  const visibleAppointments = useMemoA(() => {
    if (statusFilter === "all") return today;
    return today.filter((appointment) => appointmentStatusBucket(appointment.status) === statusFilter);
  }, [statusFilter, today]);
  const activeFilterLabel = APPOINTMENT_STATUS_FILTERS.find((filter) => filter.key === statusFilter)?.label || "appointments";
  const upcomingCount = statusCounts.upcoming;
  const activeAppointmentId = visibleAppointments.find((appointment) => appointmentStatusBucket(appointment.status) === "upcoming")?.id || null;
  const dateStr = formatScreenDate(selectedDate);
  const sectionDate = formatSectionDate(selectedDate);
  const isToday = selectedDate === currentDate;

  useEffectA(() => {
    if (selected && selected.source !== "quickwlp") loadPatientProfiles();
  }, [loadPatientProfiles, selected?.id, selected?.source]);

  useEffectA(() => {
    if (!visibleAppointments.length) return;
    if (visibleAppointments.some((appointment) => appointment.id === selectedId)) return;
    setSelectedId(visibleAppointments[0].id);
  }, [selectedId, visibleAppointments]);

  const joinAppointment = async (appointment, event) => {
    event.stopPropagation();
    setJoiningId(appointment.id);
    try {
      const response = await fetch(`${API_BASE}/doctor/appointments/${appointment.id}/session`, {
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
      const response = await fetch(`${API_BASE}/doctor/appointments/${appointment.id}/call`, {
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
      const response = await fetch(`${API_BASE}/doctor/appointments/${appointment.id}/complete`, {
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
      const response = await fetch(
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
        title={isToday ? "Today's clinic" : "Clinic schedule"}
        subtitle={dateStr}
      />
      <div className="apt-layout">
        <div className="apt-main dd-scroll">
          <div className="today-stat-row">
            <div className="stat"><div className="v">{loading ? "..." : today.length}</div><div className="l">Appointments</div></div>
            <div className="stat"><div className="v">{loading ? "..." : upcomingCount}</div><div className="l">Upcoming</div></div>
          </div>

          <div className="section-hdr">
            <div className="label apt-date-label">{sectionDate}</div>
            <div className="apt-date-actions" aria-label="Appointment date navigation">
              <button type="button" className="btn-icon" onClick={() => setSelectedDate((date) => addDays(date, -1))} aria-label="Previous day" title="Previous day">
                {I.chevronLeft}
              </button>
              <button type="button" className="apt-today-button" onClick={() => setSelectedDate(currentDate)} disabled={isToday}>
                Today
              </button>
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
          ) : today.length === 0 ? (
            <div className="empty-state apt-empty">No appointments scheduled for this date</div>
          ) : visibleAppointments.length === 0 ? (
            <div className="empty-state apt-empty">No {activeFilterLabel.toLowerCase()} appointments for this date</div>
          ) : (
            <div className="timeline">
              {visibleAppointments.map((a) => {
                const isNow = a.id === activeAppointmentId;
                const isSel = a.id === selectedId;
                return (
                  <div key={a.id} className={"tl-row" + (isNow ? " now" : "")}>
                    <div className="time">{a.time}</div>
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
                            <span>{appointmentContextLabel(a)}</span>
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

              <div className="workbench-overview">
                <WorkbenchMetric label="Slot" value={`${selected.time} · ${selected.duration} min`} />
                <WorkbenchMetric label="Source" value={selectedIsQuickWlp ? "Quick WLP" : "Lifestyle Rx"} />
                <WorkbenchMetric label="Track" value={selected.trackKey === "weight-loss" ? "Weight Loss" : toTitle(selected.trackKey || "Rx")} />
                <WorkbenchMetric label="Order" value={medicationOrderState(selected)} tone={selectedFulfillment.delivered_at ? "done" : selectedPrescription.status === "ISSUED" ? "current" : ""} />
              </div>

              <div className={`workbench-next ${selectedActionState.tone}`}>
                <span>Next action</span>
                <strong>{selectedActionState.label || nextStepLabel(selected)}</strong>
              </div>

              <section className="workbench-section workbench-section-actions">
                <div className="workbench-section-title">Actions</div>
                <div className="workbench-actions">
                  {selected.meetingLink && selected.status === "upcoming" && (
                    <>
                      <button className="dd-btn-block" onClick={(event) => joinAppointment(selected, event)} disabled={joiningId === selected.id}>
                        {joiningId === selected.id ? "Opening session..." : "Join video consultation"}
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => setCallConfirm(selected)}
                        disabled={callingId === selected.id}
                      >
                        {I.phone}<span>{callingId === selected.id ? "Calling..." : "Call Patient"}</span>
                      </button>
                    </>
                  )}
                  {canCompleteSelected && (
                    <button
                      className="btn-ghost"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => setCompleteConfirm(selected)}
                      disabled={completingId === selected.id}
                    >
                      {I.check}<span>{completingId === selected.id ? "Completing..." : "Complete Consultation"}</span>
                    </button>
                  )}
                  {canNoShowSelected && (
                    <button
                      className="btn-ghost danger"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => setNoShowConfirm(selected)}
                      disabled={noShowingId === selected.id}
                    >
                      {I.warn}<span>{noShowingId === selected.id ? "Saving..." : "Mark No-show"}</span>
                    </button>
                  )}
                  {selectedIsQuickWlp ? (
                    <button
                      className="dd-btn-block"
                      onClick={() => onPrescribeQuickWlp?.(selected)}
                      disabled={!canPrescribeSelectedQuickWlp}
                    >
                      {prescriptionIssued(selected) ? "Prescription issued" : "Issue Quick WLP prescription"}
                    </button>
                  ) : (
                    <>
                      {canPrescribeSelectedRx && (
                        <button className="dd-btn-block" onClick={() => onPrescribeRx?.(selected)}>
                          {I.pill}<span>Issue RX prescription</span>
                        </button>
                      )}
                      <button className="btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => onOpenPatient(selectedPatient.id)}>Open patient chart</button>
                      <button
                        className="btn-ghost"
                        style={{ width: "100%", justifyContent: "center", opacity: selected.chat?.available ? 1 : 0.45, cursor: selected.chat?.available ? "pointer" : "not-allowed" }}
                        onClick={() => onOpenChat(selectedPatient.id)}
                        disabled={!selected.chat?.available}
                        title={selected.chat?.available ? `Message ${selectedPatient.name}` : "Chat is locked for this patient"}
                      >
                        {I.message}<span>Message {selectedPatient.name.split(" ")[0]}</span>
                      </button>
                    </>
                  )}
                </div>
              </section>

              <section className="workbench-section">
                <div className="workbench-section-title">Operational progress</div>
                <OperationalChecklist appointment={selected} />
              </section>

              <section className="workbench-section">
                <div className="workbench-section-title">Visit details</div>
                <InfoRow label="Service" value={selected.service} />
                <InfoRow label="Mode" value={selected.type} />
                <InfoRow label="Member" value={[selectedPatient.age ? `${selectedPatient.age}y` : "", selectedPatient.sex].filter(Boolean).join(" · ")} />
                {selectedPatient.whatsapp && <InfoRow label="WhatsApp" value={selectedPatient.whatsapp} />}
                {!selectedIsQuickWlp && <InfoRow label="Chat" value={selected.chat?.available ? "Available" : "Locked until consult completion"} />}
              </section>

              <section className="workbench-section">
                <div className="workbench-section-title">Clinical summary</div>
                {selectedIsQuickWlp && <InfoRow label="Preferred" value={selectedAssessment.preferred_medication} />}
                <InfoRow label="Height / weight" value={[
                  selectedAssessment.height_cm ? `${selectedAssessment.height_cm} cm` : "",
                  selectedAssessment.weight_kg ? `${selectedAssessment.weight_kg} kg` : "",
                ].filter(Boolean).join(" · ")} />
                <InfoRow label="BMI" value={selectedAssessment.bmi} />
                <InfoRow label="Allergies" value={(selectedAssessment.allergies || []).join(", ")} />
                <InfoRow label="Conditions" value={(selectedAssessment.conditions || []).join(", ")} />
                <InfoRow label="Assessment" value={formatDateTime(selectedAssessment.latest_submitted_at)} />
              </section>

              <section className="workbench-section">
                <div className="workbench-section-title">Prescription</div>
                <InfoRow label="Status" value={selectedPrescription.status === "ISSUED" ? "Issued" : "Not issued"} />
                <InfoRow label="Issued" value={formatDateTime(selectedPrescription.issued_at)} />
              </section>

              <section className="workbench-section">
                <div className="workbench-section-title">Medication order</div>
                <InfoRow label="Status" value={medicationOrderState(selected)} />
                <InfoRow label={selectedMedicationAmount.label} value={selectedMedicationAmount.value} />
                <InfoRow label="Shipment" value={selectedFulfillment.order_id} />
                <InfoRow label="Delivered" value={formatDateTime(selectedFulfillment.delivered_at)} />
                <WorkbenchItems items={selectedPrescription.items} />
              </section>

              {!selectedIsQuickWlp && (
                <section className="workbench-section">
                  <div className="workbench-section-title">Consultation history</div>
                  <ConsultationHistory history={selectedHistory} loading={profilesLoading && !profilesLoaded} currentId={selected.id} />
                </section>
              )}

              {!selectedIsQuickWlp && (
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

              {!selectedIsQuickWlp && (
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

              {!selectedIsQuickWlp && (
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
    </>
  );
}

window.DD_AppointmentsView = AppointmentsView;
