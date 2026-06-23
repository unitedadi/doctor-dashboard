import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { fetchJson } from "../lib/authFetch.js";

/* global React */
const { useEffect: useEffectI, useMemo: useMemoI, useState: useStateI } = React;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "needs_prescription", label: "Needs prescription" },
  { key: "refill_review", label: "Refill review" },
];

function dubaiToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Dubai",
  }).format(date);
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function patientInitials(name) {
  const parts = String(name || "Patient").trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || "P"}${parts[1]?.[0] || ""}`;
}

function trackLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "weight-loss") return "Weight Loss";
  if (normalized === "peptides") return "Peptides";
  if (normalized === "quickwlp") return "Quick WLP";
  return titleCase(normalized || "Rx");
}

function sourceTagLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "JUSTLIFE") return "Justlife";
  if (normalized === "NOVO_NORDISK") return "Novo Nordisk";
  if (normalized === "REGULAR") return "Regular";
  return titleCase(normalized);
}

function mapAppointment(item) {
  const patient = item.patient || {};
  const source = item.source || "rx";
  const trackKey = source === "quickwlp" ? "quickwlp" : item.track_key || "weight-loss";
  return {
    id: item.id,
    type: "appointment",
    source,
    quickWlpLeadId: item.quickwlp_lead_id || "",
    patientId: item.patient_id || patient.id || "",
    customerId: item.customer_id || patient.customer_id || "",
    doctorId: item.doctor_id || DOCTOR_ID,
    patientName: patient.name || "Unknown patient",
    initials: patient.initials || patientInitials(patient.name),
    phone: patient.phone || patient.whatsapp || "",
    email: patient.email || "",
    age: patient.age,
    sex: patient.sex,
    status: item.status || "",
    time: item.time || "",
    date: item.date || "",
    service: item.service_name || "",
    trackKey,
    track: source === "quickwlp"
      ? ["Quick WLP", sourceTagLabel(item.source_tag)].filter(Boolean).join(" · ")
      : `${trackLabel(trackKey)} Rx`,
    sourceTag: item.source_tag || "",
    scheduledStartAt: item.scheduled_start_at,
    scheduledEndAt: item.scheduled_end_at,
    workbench: item.workbench || {},
  };
}

function mapRefillRequest(item) {
  const patient = item.patient || item.member || {};
  const customer = item.customer || {};
  const patientName = item.patient_name || patient.name || patient.full_name || "Unknown patient";
  return {
    id: item.refill_request_id || item.request_id || item.id,
    type: "refill",
    patientId: item.patient_id || item.member_id || patient.id || patient.patient_id || "",
    customerId: item.customer_id || patient.customer_id || "",
    patientName,
    initials: patient.initials || patientInitials(patientName),
    phone: item.phone || patient.phone || customer.phone || "",
    email: item.email || patient.email || customer.email || "",
    status: item.status || "PENDING",
    submittedAt: item.submitted_at || item.created_at,
    trackKey: item.track_key || "weight-loss",
    currentMedication: item.current_medication || item.medication_name || item.product_name || item.current_care_plan?.title || "",
    currentDose: item.current_dose || item.dose || item.current_care_plan?.dose || "",
  };
}

function isCompletedAppointment(appointment) {
  const status = String(appointment.status || appointment.workbench?.consultation?.status || "").toLowerCase();
  return status === "completed" || Boolean(appointment.workbench?.consultation?.completed_at);
}

function hasIssuedPrescription(appointment) {
  return appointment.workbench?.prescription?.status === "ISSUED";
}

function buildTasks({ appointments, refills }) {
  const tasks = [];

  for (const appointment of appointments) {
    if (isCompletedAppointment(appointment) && !hasIssuedPrescription(appointment)) {
      tasks.push({
        id: `needs-prescription:${appointment.id}`,
        category: "needs_prescription",
        priority: "High",
        title: "Consultation needs prescription",
        actionLabel: "Issue prescription",
        patientName: appointment.patientName,
        initials: appointment.initials,
        phone: appointment.phone,
        email: appointment.email,
        patientId: appointment.patientId,
        customerId: appointment.customerId,
        quickWlpLeadId: appointment.quickWlpLeadId,
        doctorId: appointment.doctorId,
        trackKey: appointment.trackKey,
        track: appointment.track,
        source: appointment.source,
        service: appointment.service,
        occurredAt: appointment.workbench?.consultation?.completed_at || appointment.scheduledEndAt,
        summary: `${appointment.service || appointment.track} is completed. Prescription is still pending.`,
        detail: "Review the chart and issue the medication plan if clinically appropriate.",
        raw: appointment,
      });
    }
  }

  for (const refill of refills) {
    tasks.push({
      id: `refill:${refill.id}`,
      category: "refill_review",
      priority: "Review",
      title: "Refill review",
      actionLabel: "Review refill",
      patientName: refill.patientName,
      initials: refill.initials,
      phone: refill.phone,
      email: refill.email,
      patientId: refill.patientId,
      customerId: refill.customerId,
      refillRequestId: refill.id,
      trackKey: refill.trackKey || "weight-loss",
      track: `${trackLabel(refill.trackKey || "weight-loss")} refill`,
      occurredAt: refill.submittedAt,
      summary: [refill.currentMedication, refill.currentDose].filter(Boolean).join(" · ") || "Patient submitted a refill request.",
      detail: "Review answers, side effects, progress, and dose before prescribing the next cycle.",
      raw: refill,
    });
  }

  return tasks.sort((a, b) => {
    const order = { needs_prescription: 0, refill_review: 1 };
    const byCategory = (order[a.category] ?? 9) - (order[b.category] ?? 9);
    if (byCategory !== 0) return byCategory;
    return new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime();
  });
}

function TaskRow({ task, selected, onSelect }) {
  const { Avatar } = window.DD_UI;
  return (
    <button className={`clinical-task-row${selected ? " selected" : ""}`} onClick={() => onSelect(task.id)}>
      <Avatar initials={task.initials} name={task.patientName} size="sm" />
      <span className="clinical-task-main">
        <strong>{task.patientName}</strong>
        <em>{[task.phone, task.track].filter(Boolean).join(" · ")}</em>
      </span>
      <span className={`clinical-task-priority ${task.category}`}>{task.priority}</span>
      <span className="clinical-task-type">{task.title}</span>
    </button>
  );
}

function TaskDetail({ task, onOpenPatient, onOpenChat, onPrescribeRx, onPrescribeQuickWlp }) {
  const { I, Avatar } = window.DD_UI;
  if (!task) {
    return (
      <div className="clinical-inbox-empty-detail">
        <div className="clinical-inbox-empty-icon">{I.shieldCheck}</div>
        <strong>No task selected</strong>
        <p>Select a task to see the exact clinical decision and next action.</p>
      </div>
    );
  }

  const canOpenPatient = Boolean(task.patientId);
  const canOpenChat = Boolean(task.patientId);
  const isQuickWlp = task.source === "quickwlp";
  const primaryAction = () => {
    if (task.category === "needs_prescription") {
      if (isQuickWlp) return onPrescribeQuickWlp?.(task);
      return onPrescribeRx?.(task);
    }
    if (task.category === "refill_review") {
      return onPrescribeRx?.(task);
    }
    if (canOpenPatient) return onOpenPatient?.(task.patientId, task.customerId);
    return undefined;
  };

  return (
    <aside className="clinical-inbox-detail">
      <div className="clinical-detail-head">
        <Avatar initials={task.initials} name={task.patientName} size="lg" />
        <div>
          <h2>{task.patientName}</h2>
          <p>{[task.phone, task.email].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      <div className="clinical-detail-status">
        <span>{task.title}</span>
        <strong>{task.priority}</strong>
      </div>

      <section className="clinical-detail-section">
        <div className="clinical-detail-label">Clinical decision</div>
        <h3>{task.summary}</h3>
        <p>{task.detail}</p>
      </section>

      <div className="clinical-detail-grid">
        <div><span>Track</span><strong>{task.track || "Not available"}</strong></div>
        <div><span>When</span><strong>{formatDateTime(task.occurredAt) || "Not available"}</strong></div>
        <div><span>Source</span><strong>{task.source === "quickwlp" ? "Quick WLP" : titleCase(task.source || "Rx")}</strong></div>
        <div><span>Service</span><strong>{task.service || task.track || "Not available"}</strong></div>
      </div>

      <div className="clinical-detail-actions">
        <button className="clinical-primary-action" onClick={primaryAction} disabled={!task.actionLabel}>
          {task.actionLabel}
        </button>
        {canOpenPatient && (
          <button className="clinical-secondary-action" onClick={() => onOpenPatient?.(task.patientId, task.customerId)}>
            Open patient
          </button>
        )}
        {canOpenChat && (
          <button className="clinical-secondary-action" onClick={() => onOpenChat?.(task.patientId)}>
            Message
          </button>
        )}
      </div>
    </aside>
  );
}

function ClinicalInboxView({ onOpenPatient, onOpenChat, onPrescribeRx, onPrescribeQuickWlp, onCountChange }) {
  const { Topbar } = window.DD_UI;
  const [tasks, setTasks] = useStateI([]);
  const [selectedId, setSelectedId] = useStateI(null);
  const [filter, setFilter] = useStateI("all");
  const [search, setSearch] = useStateI("");
  const [loading, setLoading] = useStateI(true);
  const [error, setError] = useStateI("");

  useEffectI(() => {
    let cancelled = false;

    async function loadInbox() {
      setLoading(true);
      setError("");
      const appointmentParams = new URLSearchParams({ date: dubaiToday(), doctor_id: DOCTOR_ID });
      const refillParams = new URLSearchParams({ doctor_id: DOCTOR_ID, status: "pending", limit: "100", offset: "0" });
      const [appointmentResult, refillResult] = await Promise.allSettled([
        fetchJson(`${API_BASE}/doctor/dashboard/appointments?${appointmentParams.toString()}`),
        fetchJson(`${API_BASE}/doctor/rx/refill-requests?${refillParams.toString()}`),
      ]);

      if (cancelled) return;

      const appointmentPayload = appointmentResult.status === "fulfilled" ? appointmentResult.value : {};
      const refillPayload = refillResult.status === "fulfilled" ? refillResult.value : {};
      const nextTasks = buildTasks({
        appointments: [...asArray(appointmentPayload.today), ...asArray(appointmentPayload.week)].map(mapAppointment),
        refills: (Array.isArray(refillPayload.requests) ? refillPayload.requests : asArray(refillPayload.refill_requests)).map(mapRefillRequest),
      });

      setTasks(nextTasks);
      setSelectedId((current) => nextTasks.some((task) => task.id === current) ? current : nextTasks[0]?.id || null);
      setError([
        appointmentResult.status === "rejected" ? "appointments" : "",
        refillResult.status === "rejected" ? "refills" : "",
      ].filter(Boolean).join(", "));
      setLoading(false);
      onCountChange?.(nextTasks.length);
    }

    loadInbox().catch(() => {
      if (!cancelled) {
        setError("clinical inbox");
        setLoading(false);
        onCountChange?.(null);
      }
    });

    return () => { cancelled = true; };
  }, [onCountChange]);

  const visibleTasks = useMemoI(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (filter !== "all" && task.category !== filter) return false;
      if (!query) return true;
      return [task.patientName, task.phone, task.email, task.title, task.track, task.summary].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [filter, search, tasks]);

  const selected = visibleTasks.find((task) => task.id === selectedId) || visibleTasks[0] || null;
  const counts = useMemoI(() => ({
    open: tasks.length,
    needsPrescription: tasks.filter((task) => task.category === "needs_prescription").length,
    refills: tasks.filter((task) => task.category === "refill_review").length,
  }), [tasks]);

  return (
    <div className="screen clinical-inbox-screen fade-in">
      <Topbar
        title="Clinical Inbox"
        subtitle="Doctor decisions only: prescriptions, refills, re-issues, and no-show review."
        search={search}
        onSearch={setSearch}
      />

      <div className="clinical-inbox-layout">
        <div className="clinical-inbox-list">
          <div className="clinical-inbox-stats">
            <div><span>Open</span><strong>{counts.open}</strong></div>
            <div><span>Needs prescription</span><strong>{counts.needsPrescription}</strong></div>
            <div><span>Refills</span><strong>{counts.refills}</strong></div>
          </div>

          <div className="clinical-inbox-filters">
            {FILTERS.map((item) => (
              <button key={item.key} className={filter === item.key ? "active" : ""} onClick={() => setFilter(item.key)}>
                {item.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="clinical-inbox-warning">
              Could not load {error}. Showing the remaining available tasks.
            </div>
          )}

          <div className="clinical-task-list">
            {loading ? (
              <div className="clinical-inbox-empty">Loading clinical tasks...</div>
            ) : visibleTasks.length ? (
              visibleTasks.map((task) => (
                <TaskRow key={task.id} task={task} selected={selected?.id === task.id} onSelect={setSelectedId} />
              ))
            ) : (
              <div className="clinical-inbox-empty">No clinical tasks match this view.</div>
            )}
          </div>
        </div>

        <TaskDetail
          task={selected}
          onOpenPatient={onOpenPatient}
          onOpenChat={onOpenChat}
          onPrescribeRx={onPrescribeRx}
          onPrescribeQuickWlp={onPrescribeQuickWlp}
        />
      </div>
    </div>
  );
}

window.DD_ClinicalInboxView = ClinicalInboxView;
