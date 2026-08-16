import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { authFetch, fetchJson } from "../lib/authFetch.js";
import { clinicalTaskCategory, isDoctorClinicalTask, summarizeClinicalInboxTasks } from "../lib/clinicalInboxSummary.js";

/* global React */
const { useEffect: useEffectI, useMemo: useMemoI, useState: useStateI } = React;

const GROUPS = [
  { key: "needs_prescription", label: "Needs prescription" },
  { key: "reissue", label: "Re-issue" },
  { key: "needs_outcome", label: "Needs outcome" },
  { key: "refill_review", label: "Refill review" },
  { key: "lab_results_ready", label: "Lab results ready" },
  { key: "message_needs_response", label: "Needs reply" },
];

const CATEGORY_COPY = {
  needs_prescription: {
    label: "Needs prescription",
    queueLabel: "Issue prescription",
    reason: "The backend marked the consultation completed with no prescription issued. Never inferred from slot time.",
    decision: "Review the chart, confirm medication choice, and issue the prescription if clinically appropriate.",
    closes: "Closed when the prescription is issued.",
    actionFallback: "Issue prescription",
    tone: "critical",
  },
  needs_outcome: {
    label: "Needs outcome",
    queueLabel: "Record outcome",
    reason: "The consultation is complete but no clinical outcome has been recorded for this cycle.",
    decision: "Record whether the patient continues existing treatment, needs a new prescription, is undecided, or is not eligible.",
    closes: "Closed when the outcome is saved.",
    actionFallback: "Record outcome",
    tone: "steady",
  },
  reissue: {
    label: "Re-issue",
    queueLabel: "Re-issue unpaid prescription",
    reason: "An unpaid prescription can still be clinically changed before payment.",
    decision: "Review the original prescription and issue a replacement with a documented reason.",
    closes: "Closed when the replacement is issued.",
    actionFallback: "Re-issue prescription",
    tone: "critical",
  },
  message_needs_response: {
    label: "Needs reply",
    queueLabel: "Needs reply",
    reason: "The patient sent a message and there is no newer doctor or care-team reply.",
    decision: "Read the message in context and reply from Chat.",
    closes: "Closed when you reply in the conversation.",
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
  lab_results_ready: {
    label: "Lab results ready",
    queueLabel: "Review lab results",
    reason: "A doctor-prescribed lab order now has its final report.",
    decision: "Open the signed report and review it through the current PDF workflow.",
    closes: "Task closure is not available from this dashboard yet.",
    actionFallback: "Download PDF",
    tone: "critical",
  },
};

async function downloadLabReport(reportUrl) {
  if (!reportUrl) return;
  const response = await authFetch(reportUrl.startsWith("http") ? reportUrl : `${API_BASE}${reportUrl}`);
  if (!response.ok) throw new Error("Could not open the lab report.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = "lab-results.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
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

function formatQueueTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Dubai",
  }).format(date);
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Dubai",
  }).format(new Date());
  return new Intl.DateTimeFormat("en-US", dateKey === todayKey
    ? { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dubai" }
    : { month: "short", day: "numeric", timeZone: "Asia/Dubai" }
  ).format(date);
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

function sourceMeta(task) {
  const source = String(task?.source || "").toLowerCase();
  if (source === "rx") return "Rx";
  if (source === "quickwlp" || source === "quick_wlp") return "Quick Consult";
  return titleCase(task?.source || "");
}

function lifecycleForTask(task) {
  const category = String(task?.category || "").toLowerCase();
  if (category === "lab_results_ready") {
    return [
      { label: "Prescribed", meta: "Doctor request created", state: "done" },
      { label: "Booked", meta: "Patient completed checkout", state: "done" },
      { label: "Results ready", meta: formatDateTime(task?.occurredAt) || "Report available", state: "current" },
      { label: "Follow-up", meta: "To be decided", state: "pending" },
    ];
  }
  const isNeedsPrescription = category === "needs_prescription";
  const isNeedsOutcome = category === "needs_outcome";
  const isReissue = category === "reissue";
  const isRefill = category === "refill_review";
  const isMessage = category === "message_needs_response";
  const when = formatDateTime(task?.occurredAt);

  if (isMessage) {
    return [
      { label: "Received", meta: when || "Patient message", state: "done" },
      { label: "Doctor reply", meta: "Reply from the conversation", state: "current" },
      { label: "Resolved", meta: "After a reply or no-reply decision", state: "pending" },
    ];
  }
  if (isRefill) {
    return [
      { label: "Request", meta: when || "Patient submitted", state: "done" },
      { label: "Clinical review", meta: "Doctor decision needed", state: "current" },
      { label: "Prescription", meta: "Pending", state: "pending" },
      { label: "Fulfilment", meta: "Pending", state: "pending" },
    ];
  }
  return [
    {
      label: "Consultation",
      meta: "Completed",
      state: "done",
    },
    {
      label: "Outcome",
      meta: isNeedsOutcome ? "Not recorded" : "Recorded",
      state: isNeedsOutcome ? "current" : "done",
    },
    {
      label: "Prescription",
      meta: isReissue ? "Issued, unpaid · replaceable" : isNeedsPrescription ? "Not issued" : "Pending",
      state: isReissue || isNeedsPrescription ? "current" : "pending",
    },
    { label: "Payment", meta: "Pending", state: "pending" },
    { label: "Delivery", meta: "Pending", state: "pending" },
  ];
}

function ClinicalLifecycleStrip({ task }) {
  const ClinicalThread = window.DD_UI.ClinicalThread;
  return <ClinicalThread steps={lifecycleForTask(task)} layout="horizontal" />;
}

function memberMeta(task) {
  return [
    task?.patientAge ? `${task.patientAge}y` : "",
    task?.patientSex,
    task?.track,
    sourceMeta(task),
  ].filter(Boolean).join(" · ");
}

function mapClinicalTask(item) {
  const patient = item.patient || {};
  const patientName = patient.name || item.patient_name || "Unknown patient";
  return {
    id: item.id || `${item.category || item.type}:${item.source_id || item.refill_request_id || item.appointment_id}`,
    category: clinicalTaskCategory(item),
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
    appointmentId: item.appointment_id || "",
    sourceId: item.source_id || "",
    channelId: item.channel_id || item.channelId || "",
    quickWlpLeadId: item.quickwlp_lead_id || item.quickWlpLeadId || "",
    doctorId: item.doctor_id || DOCTOR_ID,
    refillRequestId: item.refill_request_id || "",
    labRequestId: item.lab_request_id || "",
    orderId: item.order_id || "",
    reportUrl: item.report_url || "",
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

function TaskRow({ task, selected, onSelect }) {
  return (
    <button className={`clinical-task-row${selected ? " selected" : ""}`} onClick={() => onSelect(task.id)}>
      <span className="clinical-task-main">
        <strong>{task.patientName}</strong>
        <em>{task.summary || task.title}</em>
      </span>
      <time>{formatQueueTime(task.occurredAt) || "Time unavailable"}</time>
    </button>
  );
}

function TaskDetail({ task, onOpenPatient, onOpenChat, onOpenContextChat, onPrescribeRx, onPrescribeQuickWlp, onRecordOutcome, onDismissRefill, refillActionId }) {
  const { I, Avatar, StatusChip, ClinicalContextBanner } = window.DD_UI;
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
  const rawPatient = task.raw?.patient || {};
  const allergies = asArray(rawPatient.allergies || task.raw?.allergies);
  const conditions = asArray(rawPatient.conditions || task.raw?.conditions);
  const currentMedication = asArray(rawPatient.medications || task.raw?.medications)
    .map((item) => typeof item === "string" ? item : item?.name || item?.title)
    .find(Boolean) || "Not listed";
  const primaryAction = () => {
    if (task.action === "REVIEW_LAB_RESULTS" || task.category === "lab_results_ready") {
      return downloadLabReport(task.reportUrl).catch((err) => window.alert(err.message));
    }
    if (task.action === "RECORD_CONSULT_OUTCOME" || task.category === "needs_outcome") {
      return onRecordOutcome?.(task);
    }
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
          <p>{[task.phone, memberMeta(task)].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      <div className="clinical-detail-status">
        <StatusChip label={actionLabel} tone={copy.tone === "critical" ? "risk" : task.category === "message_needs_response" ? "reply" : "active"} />
      </div>

      <section className="clinical-decision-summary">
        <span>Decision needed</span>
        <h3>{task.summary || task.title}</h3>
        <p>{copy.reason}</p>
        <p>{copy.closes}</p>
      </section>

      <section className="clinical-detail-section">
        <div className="clinical-detail-label">Clinical thread</div>
        <ClinicalLifecycleStrip task={task} />
      </section>

      <ClinicalContextBanner allergies={allergies} conditions={conditions} label="Safety" always />

      <section className="clinical-detail-section clinical-detail-context">
        <div className="clinical-detail-label">Patient context</div>
        <dl className="clinical-detail-facts">
          <div><dt>Service</dt><dd>{task.service || task.track || "Not available"}</dd></div>
          <div><dt>Entered queue</dt><dd>{formatDateTime(task.occurredAt) ? `${formatDateTime(task.occurredAt)} · Dubai` : "Not available"}</dd></div>
          <div><dt>Source</dt><dd>{sourceLabel(task)}</dd></div>
          <div><dt>Current medication</dt><dd>{currentMedication}</dd></div>
        </dl>
      </section>

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
            Open chart
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
            Open conversation
          </button>
        )}
        {task.category === "refill_review" && (
          <button
            className="clinical-secondary-action"
            onClick={() => onDismissRefill?.(task)}
            disabled={refillActionId === task.refillRequestId}
          >
            {refillActionId === task.refillRequestId ? "Saving..." : "No refill needed"}
          </button>
        )}
      </div>
    </aside>
  );
}

function ClinicalInboxView({ onOpenPatient, onOpenChat, onPrescribeRx, onPrescribeQuickWlp, onCountChange, onBreakdownChange, initialCategory = "" }) {
  const { Topbar, ConfirmationModal, ActionToast } = window.DD_UI;
  const PatientChatDrawer = window.DD_PatientChatDrawer;
  const ConsultOutcomeModal = window.DD_ConsultOutcomeModal;
  const [tasks, setTasks] = useStateI([]);
  const [selectedId, setSelectedId] = useStateI(null);
  const [search, setSearch] = useStateI("");
  const [loading, setLoading] = useStateI(true);
  const [error, setError] = useStateI("");
  const [chatTask, setChatTask] = useStateI(null);
  const [outcomeTask, setOutcomeTask] = useStateI(null);
  const [reloadToken, setReloadToken] = useStateI(0);
  const [refillActionId, setRefillActionId] = useStateI("");
  const [expandedGroups, setExpandedGroups] = useStateI({});
  const [dismissTask, setDismissTask] = useStateI(null);
  const [actionError, setActionError] = useStateI("");
  const [actionToast, setActionToast] = useStateI("");
  const [categoryFilter, setCategoryFilter] = useStateI(initialCategory);

  useEffectI(() => {
    setCategoryFilter(GROUPS.some((group) => group.key === initialCategory) ? initialCategory : "");
  }, [initialCategory]);

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
    }

    loadInbox().catch(() => {
      if (!cancelled) {
        setError("clinical inbox");
        setLoading(false);
        onCountChange?.(null);
      }
    });

    return () => { cancelled = true; };
  }, [onCountChange, reloadToken]);

  const dismissRefillReview = async (task) => {
    const refillRequestId = task?.refillRequestId || task?.sourceId;
    if (!refillRequestId) return;

    setRefillActionId(refillRequestId);
    setActionError("");
    try {
      await fetchJson(`${API_BASE}/doctor/rx/refill-requests/${encodeURIComponent(refillRequestId)}/mark-not-needed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: DOCTOR_ID,
          reason: "NO_REFILL_NEEDED",
        }),
      });
      const nextTasks = tasks.filter((item) => item.refillRequestId !== refillRequestId);
      setTasks(nextTasks);
      setSelectedId((selected) => nextTasks.some((item) => item.id === selected) ? selected : nextTasks[0]?.id || null);
      const summary = summarizeClinicalInboxTasks(nextTasks);
      onCountChange?.(summary.total);
      onBreakdownChange?.(summary);
      setReloadToken((value) => value + 1);
      setActionToast("Refill request closed as no refill needed");
      window.setTimeout(() => setActionToast(""), 3200);
    } catch (err) {
      setActionError(err?.message || "Could not close the refill request. Nothing changed.");
    } finally {
      setRefillActionId("");
      setDismissTask(null);
    }
  };

  const activeTasks = categoryFilter ? tasks.filter((task) => task.category === categoryFilter) : tasks;

  useEffectI(() => {
    if (!loading && !error) {
      const summary = summarizeClinicalInboxTasks(tasks);
      onCountChange?.(summary.total);
      onBreakdownChange?.(summary);
    }
  }, [error, loading, onBreakdownChange, onCountChange, tasks]);

  const visibleTasks = useMemoI(() => {
    const query = search.trim().toLowerCase();
    return activeTasks.filter((task) => {
      if (!query) return true;
      return [task.patientName, task.phone, task.email, task.title, task.track, task.summary].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [activeTasks, search]);

  const groupedTasks = useMemoI(() => GROUPS.map((group) => ({
    ...group,
    tasks: visibleTasks.filter((task) => task.category === group.key),
  })).filter((group) => group.tasks.length), [visibleTasks]);

  const selected = visibleTasks.find((task) => task.id === selectedId) || visibleTasks[0] || null;
  const selectedGroup = GROUPS.find((group) => group.key === categoryFilter);
  return (
    <div className="screen clinical-inbox-screen fade-in">
      <Topbar
        title="Clinical inbox"
        subtitle={loading ? "Loading clinical work…" : `${activeTasks.length} task${activeTasks.length === 1 ? "" : "s"} need a doctor decision.`}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search tasks or patients"
      />

      <div className="clinical-inbox-layout">
        <div className="clinical-inbox-list">
          {error && (
            <div className="clinical-inbox-warning">
              Could not load {error}. Please refresh and try again.
            </div>
          )}
          {actionError ? <div className="clinical-inbox-warning" role="alert">{actionError}</div> : null}

          {selectedGroup ? (
            <div className="clinical-inbox-active-filter" role="status">
              <span>Showing {selectedGroup.label.toLowerCase()}</span>
              <button type="button" onClick={() => setCategoryFilter("")}>Show all tasks</button>
            </div>
          ) : null}

          <div className="clinical-task-list">
            {loading ? (
              <div className="clinical-inbox-empty">Loading clinical tasks...</div>
            ) : groupedTasks.length ? (
              groupedTasks.map((group) => {
                const expanded = Boolean(expandedGroups[group.key]);
                const rows = expanded ? group.tasks : group.tasks.slice(0, 5);
                return (
                  <section className="clinical-task-group" key={group.key}>
                    <div className="clinical-task-group-head">
                      <span>{group.label}</span>
                      <strong>{group.tasks.length}</strong>
                    </div>
                    {rows.map((task) => (
                      <TaskRow key={task.id} task={task} selected={selected?.id === task.id} onSelect={setSelectedId} />
                    ))}
                    {group.tasks.length > 5 ? (
                      <button type="button" className="clinical-task-group-more" onClick={() => setExpandedGroups((current) => ({ ...current, [group.key]: !expanded }))}>
                        {expanded ? "Show fewer" : `Show all ${group.tasks.length}`}
                      </button>
                    ) : null}
                  </section>
                );
              })
            ) : (
              <div className="clinical-inbox-empty">
                {activeTasks.length ? "No clinical work matches this search." : "No outstanding clinical work"}
              </div>
            )}
          </div>
        </div>

        <TaskDetail
          task={selected}
          onOpenPatient={onOpenPatient}
          onOpenChat={onOpenChat}
          onOpenContextChat={setChatTask}
          onRecordOutcome={setOutcomeTask}
          onPrescribeRx={onPrescribeRx}
          onPrescribeQuickWlp={onPrescribeQuickWlp}
          onDismissRefill={setDismissTask}
          refillActionId={refillActionId}
        />
      </div>
      {ConsultOutcomeModal && (
        <ConsultOutcomeModal
          open={Boolean(outcomeTask)}
          appointmentId={outcomeTask?.appointmentId || outcomeTask?.sourceId || ""}
          patientName={outcomeTask?.patientName || ""}
          appointmentSource={outcomeTask?.source || ""}
          onClose={() => setOutcomeTask(null)}
          onSaved={(_result, _outcome, nextAction) => {
            const task = outcomeTask;
            if (nextAction === "PRESCRIBE") {
              if (task?.source === "quickwlp" || task?.source === "quick_wlp") {
                onPrescribeQuickWlp?.(task);
                return;
              }
              onPrescribeRx?.(task);
              return;
            }
            setReloadToken((value) => value + 1);
          }}
        />
      )}
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
      <ConfirmationModal
        open={Boolean(dismissTask)}
        title="Mark no refill needed?"
        description={`${dismissTask?.patientName || "This patient"}'s request will leave the queue for everyone. It can only return through a new refill request.`}
        confirmLabel="Mark no refill needed"
        tone="danger"
        busy={Boolean(refillActionId)}
        onConfirm={() => dismissRefillReview(dismissTask)}
        onCancel={() => setDismissTask(null)}
      />
      <ActionToast message={actionToast} />
    </div>
  );
}

window.DD_ClinicalInboxView = ClinicalInboxView;
