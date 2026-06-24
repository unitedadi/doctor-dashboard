import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { fetchJson } from "../lib/authFetch.js";

/* global React */
const { useEffect: useEffectI, useMemo: useMemoI, useState: useStateI } = React;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "needs_prescription", label: "Needs prescription" },
  { key: "message_needs_response", label: "Needs reply" },
  { key: "reissue", label: "Re-issue" },
  { key: "refill_review", label: "Refill review" },
];

const DOCTOR_TASK_CATEGORIES = new Set([
  "needs_prescription",
  "message_needs_response",
  "reissue",
  "refill_review",
]);

const CATEGORY_COPY = {
  needs_prescription: {
    label: "Needs prescription",
    queueLabel: "Issue prescription",
    reason: "The backend has marked the consultation completed and no prescription has been issued. It is not based on estimated slot time.",
    decision: "Review the chart, confirm medication choice, and issue the prescription if clinically appropriate.",
    closes: "Closed when the prescription is issued.",
    actionFallback: "Issue prescription",
    tone: "critical",
  },
  reissue: {
    label: "Re-issue",
    queueLabel: "Re-issue unpaid prescription",
    reason: "An unpaid prescription can still be clinically changed before payment.",
    decision: "Review the original prescription and issue a replacement with a documented reason.",
    closes: "Closed when the replacement prescription is issued.",
    actionFallback: "Re-issue prescription",
    tone: "critical",
  },
  message_needs_response: {
    label: "Needs reply",
    queueLabel: "Needs reply",
    reason: "The patient sent an app message and there is no newer doctor or care-team reply.",
    decision: "Read the message in context and reply from Chat.",
    closes: "Closed when the doctor replies in the patient chat.",
    actionFallback: "Reply to patient",
    tone: "steady",
  },
  refill_review: {
    label: "Refill review",
    queueLabel: "Review refill",
    reason: "A patient submitted a refill request that needs a doctor decision.",
    decision: "Review progress, side effects, and current medication before issuing the refill.",
    closes: "Closed when the refill prescription is issued.",
    actionFallback: "Issue refill prescription",
    tone: "steady",
  },
};

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

function taskCopy(task) {
  return CATEGORY_COPY[task?.category] || CATEGORY_COPY.needs_prescription;
}

function sourceLabel(task) {
  const source = String(task?.source || "").toLowerCase();
  if (source === "quickwlp" || source === "quick_wlp") return "Quick Consult";
  if (source === "rx") return "Lifestyle Rx";
  return titleCase(task?.source || "Clinical");
}

function lifecycleForTask(task) {
  const category = String(task?.category || "").toLowerCase();
  const isNeedsPrescription = category === "needs_prescription";
  const isReissue = category === "reissue";
  const isRefill = category === "refill_review";
  const isMessage = category === "message_needs_response";
  const when = formatDateTime(task?.occurredAt);

  return [
    {
      label: "Consultation scheduled",
      meta: isMessage ? "Check chart if needed" : "Completed before this task",
      state: isMessage ? "pending" : "done",
    },
    {
      label: "Consultation completed",
      meta: isNeedsPrescription ? when || "Complete" : isMessage ? "Depends on chart" : "Complete",
      state: isMessage ? "pending" : "done",
    },
    {
      label: isNeedsPrescription ? "Prescription not issued" : "Prescription issued",
      meta: isNeedsPrescription ? "Doctor decision needed" : isReissue ? "Unpaid prescription can change" : isRefill ? "Previous treatment exists" : "Check chart",
      state: isNeedsPrescription ? "current" : isMessage ? "pending" : "done",
    },
    {
      label: "Issued but unpaid",
      meta: isReissue ? "Re-issue before payment" : "No unpaid prescription in this task",
      state: isReissue ? "current" : "pending",
    },
    {
      label: "Paid",
      meta: isRefill ? "Review before next order" : "Outside this task",
      state: "pending",
    },
    {
      label: "Delivered",
      meta: isRefill ? "Prior treatment complete" : "Outside this task",
      state: isRefill ? "done" : "pending",
    },
    {
      label: "Follow-up/refill due",
      meta: isRefill ? "Needs refill decision" : isMessage ? "Patient reply due" : "Not due yet",
      state: isRefill || isMessage ? "current" : "pending",
    },
  ];
}

function ClinicalLifecycleStrip({ task }) {
  return (
    <div className="rx-lifecycle-strip clinical-lifecycle-strip">
      {lifecycleForTask(task).map((step) => (
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

function memberMeta(task) {
  return [
    task?.patientAge ? `${task.patientAge}y` : "",
    task?.patientSex,
  ].filter(Boolean).join(" · ");
}

function mapClinicalTask(item) {
  const patient = item.patient || {};
  const patientName = patient.name || item.patient_name || "Unknown patient";
  return {
    id: item.id || `${item.category || item.type}:${item.source_id || item.refill_request_id || item.appointment_id}`,
    category: String(item.category || (item.type === "REFILL_REVIEW" ? "refill_review" : "needs_prescription")).toLowerCase(),
    type: item.type || "",
    priority: item.priority || "Review",
    title: item.title || "Clinical task",
    action: String(item.action || "").toUpperCase(),
    actionLabel: item.action_label || item.actionLabel || "Review",
    patientName,
    initials: patient.initials || patientInitials(patientName),
    phone: patient.phone || item.phone || "",
    email: patient.email || item.email || "",
    patientAge: patient.age || item.age || "",
    patientSex: titleCase(patient.sex || item.sex || ""),
    patientId: item.patient_id || patient.id || "",
    customerId: item.customer_id || patient.customer_id || "",
    channelId: item.channel_id || item.channelId || "",
    quickWlpLeadId: item.quickwlp_lead_id || item.quickWlpLeadId || "",
    doctorId: item.doctor_id || DOCTOR_ID,
    refillRequestId: item.refill_request_id || "",
    trackKey: item.track_key || "weight-loss",
    track: item.track || "",
    source: String(item.source || "").toLowerCase(),
    service: item.service || "",
    occurredAt: item.occurred_at || item.created_at || "",
    summary: item.summary || "",
    detail: item.detail || "",
    raw: item,
  };
}

function isDoctorClinicalTask(task) {
  if (!task) return false;
  const category = String(task.category || "").toLowerCase();
  if (!DOCTOR_TASK_CATEGORIES.has(category)) return false;
  const action = String(task.action || "").toUpperCase();
  if (!action) return true;
  return [
    "PRESCRIBE_RX",
    "PRESCRIBE_QUICK_WLP",
    "PRESCRIBE_REFILL",
    "REPLY_TO_PATIENT",
    "REISSUE_PRESCRIPTION",
    "AMEND_PRESCRIPTION",
  ].includes(action);
}

function clinicalTaskCountForFilter(tasks, key) {
  if (key === "all") return tasks.length;
  return tasks.filter((task) => task.category === key).length;
}

function visibleClinicalFilters(tasks) {
  return FILTERS.filter((item) => item.key === "all" || clinicalTaskCountForFilter(tasks, item.key) > 0);
}

function TaskRow({ task, selected, onSelect }) {
  const { Avatar } = window.DD_UI;
  const copy = taskCopy(task);
  return (
    <button className={`clinical-task-row${selected ? " selected" : ""}`} onClick={() => onSelect(task.id)}>
      <Avatar initials={task.initials} name={task.patientName} size="sm" />
      <span className="clinical-task-main">
        <strong>{task.patientName}</strong>
        <em>{[task.phone, memberMeta(task), task.track].filter(Boolean).join(" · ")}</em>
      </span>
      <span className={`clinical-task-priority ${copy.tone} ${task.category}`}>{copy.queueLabel}</span>
      <span className="clinical-task-type">
        <strong>{task.summary || task.title}</strong>
        <em>{[formatDateTime(task.occurredAt), sourceLabel(task)].filter(Boolean).join(" · ")}</em>
      </span>
    </button>
  );
}

function TaskDetail({ task, onOpenPatient, onOpenChat, onOpenContextChat, onPrescribeRx, onPrescribeQuickWlp }) {
  const { I, Avatar } = window.DD_UI;
  const PatientChart = window.DD_PatientChart;
  if (!task) {
    return (
      <div className="clinical-inbox-empty-detail">
        <div className="clinical-inbox-empty-icon">{I.shieldCheck}</div>
        <strong>No task selected</strong>
        <p>Select a task to see the exact clinical decision and next action.</p>
      </div>
    );
  }

  const isQuickWlp = task.action === "PRESCRIBE_QUICK_WLP" || task.source === "quickwlp" || task.source === "quick_wlp";
  const canOpenPatient = Boolean(task.patientId);
  const canOpenChat = !isQuickWlp && Boolean(task.patientId || task.channelId);
  const copy = taskCopy(task);
  const actionLabel = task.actionLabel || copy.actionFallback;
  const primaryAction = () => {
    if (task.action === "REPLY_TO_PATIENT" || task.category === "message_needs_response") {
      return onOpenContextChat?.(task);
    }
    if (task.action === "REISSUE_PRESCRIPTION" || task.action === "AMEND_PRESCRIPTION" || task.category === "reissue") {
      return onPrescribeRx?.(task);
    }
    if (task.action === "PRESCRIBE_REFILL" || task.category === "refill_review") {
      return onPrescribeRx?.(task);
    }
    if (task.action === "PRESCRIBE_QUICK_WLP" || isQuickWlp) {
      return onPrescribeQuickWlp?.(task);
    }
    if (task.action === "PRESCRIBE_RX" || task.category === "needs_prescription") {
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
          <p>{[task.phone, task.email, memberMeta(task)].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      <div className="clinical-detail-status">
        <span>{copy.label}</span>
        <strong>Doctor action required</strong>
      </div>

      {!PatientChart && (
      <section className="clinical-detail-section">
        <div className="clinical-detail-label">Prescription lifecycle</div>
        <ClinicalLifecycleStrip task={task} />
      </section>
      )}

      <section className="clinical-decision-summary">
        <div>
          <span>Decision needed</span>
          <h3>{task.summary || task.title}</h3>
          <p>{copy.decision || task.detail || "Review the patient context and complete the clinical action."}</p>
        </div>
        <dl>
          <div>
            <dt>Why shown</dt>
            <dd>{copy.reason}</dd>
          </div>
          <div>
            <dt>Leaves inbox when</dt>
            <dd>{copy.closes}</dd>
          </div>
        </dl>
      </section>

      {PatientChart && task.patientId ? (
        <section className="clinical-detail-section clinical-detail-patient-chart">
          <PatientChart
            patientId={task.patientId}
            mode="task"
            focus="clinical-inbox"
            context={{ task, label: "Clinical Inbox" }}
            onOpenPatient={onOpenPatient}
            onMessage={() => onOpenContextChat?.(task)}
            onPrescribe={({ patientId, customerId, trackKey, mode }) => onPrescribeRx?.({ ...task, patientId, customerId, trackKey, prescriptionMode: mode })}
          />
        </section>
      ) : null}

      <div className="clinical-detail-meta-line">
        <span>{task.track || "Track not available"}</span>
        <span>{formatDateTime(task.occurredAt) || "Time not available"}</span>
        <span>{sourceLabel(task)}</span>
        <span>{task.service || task.track || "Service not available"}</span>
      </div>

      {isQuickWlp ? (
        <div className="clinical-detail-note">
          Quick Consult patient. This one-off flow does not include in-app chat access; use the patient phone number for follow-up.
        </div>
      ) : null}

      <div className="clinical-detail-actions">
        <button className="clinical-primary-action" onClick={primaryAction} disabled={!actionLabel}>
          {actionLabel}
        </button>
        {canOpenPatient && (
          <button className="clinical-secondary-action" onClick={() => onOpenPatient?.(task.patientId, task.customerId)}>
            Open patient
          </button>
        )}
        {canOpenChat && (
          <button
            className="clinical-secondary-action"
            onClick={() => {
              if (onOpenContextChat) {
                onOpenContextChat(task);
                return;
              }
              onOpenChat?.(task.patientId, task.channelId);
            }}
          >
            Open chat
          </button>
        )}
      </div>
    </aside>
  );
}

function ClinicalInboxView({ onOpenPatient, onOpenChat, onPrescribeRx, onPrescribeQuickWlp, onCountChange }) {
  const { Topbar } = window.DD_UI;
  const PatientChatDrawer = window.DD_PatientChatDrawer;
  const [tasks, setTasks] = useStateI([]);
  const [selectedId, setSelectedId] = useStateI(null);
  const [filter, setFilter] = useStateI("all");
  const [search, setSearch] = useStateI("");
  const [loading, setLoading] = useStateI(true);
  const [error, setError] = useStateI("");
  const [chatTask, setChatTask] = useStateI(null);

  useEffectI(() => {
    let cancelled = false;

    async function loadInbox() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        doctor_id: DOCTOR_ID,
        lookback_days: "90",
        limit: "100",
      });
      const payload = await fetchJson(`${API_BASE}/doctor/clinical-inbox?${params.toString()}`);
      if (cancelled) return;

      const nextTasks = asArray(payload.tasks)
        .map(mapClinicalTask)
        .filter(isDoctorClinicalTask);
      setTasks(nextTasks);
      setSelectedId((current) => nextTasks.some((task) => task.id === current) ? current : nextTasks[0]?.id || null);
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
  const availableFilters = useMemoI(() => visibleClinicalFilters(tasks), [tasks]);

  useEffectI(() => {
    if (filter === "all") return;
    if (availableFilters.some((item) => item.key === filter)) return;
    setFilter("all");
  }, [availableFilters, filter]);

  const selected = visibleTasks.find((task) => task.id === selectedId) || visibleTasks[0] || null;
  const counts = useMemoI(() => ({
    open: tasks.length,
    needsPrescription: tasks.filter((task) => task.category === "needs_prescription").length,
    messages: tasks.filter((task) => task.category === "message_needs_response").length,
    reissue: tasks.filter((task) => task.category === "reissue").length,
    refills: tasks.filter((task) => task.category === "refill_review").length,
  }), [tasks]);

  return (
    <div className="screen clinical-inbox-screen fade-in">
      <Topbar
        title="Clinical Inbox"
        subtitle="Doctor actions only: prescriptions, re-issues, refill reviews, and patient messages that still need a reply."
        search={search}
        onSearch={setSearch}
      />

      <div className="clinical-inbox-layout">
        <div className="clinical-inbox-list">
          <div className="clinical-inbox-stats">
            <div><span>Open</span><strong>{counts.open}</strong></div>
            <div><span>Needs prescription</span><strong>{counts.needsPrescription}</strong></div>
            <div><span>Needs reply</span><strong>{counts.messages}</strong></div>
            <div><span>Re-issue</span><strong>{counts.reissue}</strong></div>
            <div><span>Refills</span><strong>{counts.refills}</strong></div>
          </div>

          <div className="clinical-inbox-filters">
            {availableFilters.map((item) => (
              <button key={item.key} className={filter === item.key ? "active" : ""} onClick={() => setFilter(item.key)}>
                <span>{item.label}</span>
                <strong>{clinicalTaskCountForFilter(tasks, item.key)}</strong>
              </button>
            ))}
          </div>

          {error && (
            <div className="clinical-inbox-warning">
              Could not load {error}. Please refresh and try again.
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
              <div className="clinical-inbox-empty">
                {tasks.length ? "No doctor actions match this view." : "No doctor actions pending."}
              </div>
            )}
          </div>
        </div>

        <TaskDetail
          task={selected}
          onOpenPatient={onOpenPatient}
          onOpenChat={onOpenChat}
          onOpenContextChat={setChatTask}
          onPrescribeRx={onPrescribeRx}
          onPrescribeQuickWlp={onPrescribeQuickWlp}
        />
      </div>
      {PatientChatDrawer && (
        <PatientChatDrawer
          open={Boolean(chatTask)}
          patientId={chatTask?.patientId || ""}
          customerId={chatTask?.customerId || ""}
          channelId={chatTask?.channelId || ""}
          patientName={chatTask?.patientName || ""}
          onClose={() => setChatTask(null)}
          onOpenPatient={(id, customerId) => {
            setChatTask(null);
            onOpenPatient?.(id || chatTask?.patientId, customerId || chatTask?.customerId);
          }}
          onPrescribe={onPrescribeRx}
        />
      )}
    </div>
  );
}

window.DD_ClinicalInboxView = ClinicalInboxView;
