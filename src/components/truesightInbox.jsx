import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { fetchJson } from "../lib/authFetch.js";

const { useCallback, useEffect, useMemo, useState } = React;

const FILTERS = [
  { key: "OPEN", label: "Open" },
  { key: "ACKNOWLEDGED", label: "Acknowledged" },
  { key: "REVIEWED", label: "Reviewed" },
  { key: "RESOLVED", label: "Resolved" },
];

function isoOffset(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function previewInbox() {
  const patient = (patient_id, name, age, gender) => ({ patient_id, name, age, gender });
  const base = {
    assigned_doctor_id: DOCTOR_ID,
    owner: { doctor_id: DOCTOR_ID, name: "Dr. Sami", email: "dr.sami@dardoc.com" },
    assigned_at: isoOffset(-45),
    track_key: "weight-loss",
    created_at: isoOffset(-45),
    updated_at: isoOffset(-5),
    actions: [],
  };
  return {
    doctor_id: DOCTOR_ID,
    generated_at: new Date().toISOString(),
    summary: { open: 3, urgent: 1, overdue: 2, final_escalations: 1, acknowledged: 1, reviewed: 1 },
    items: [
      {
        ...base,
        handoff_id: "preview-urgent-aisha",
        customer_id: "preview-aisha",
        patient_id: "preview-aisha-patient",
        subscription_id: "preview-aisha-subscription",
        channel_id: "preview-aisha-chat",
        message_id: "preview-aisha-message",
        urgency: "URGENT",
        status: "DELIVERED",
        attention_state: "FINAL_ESCALATION",
        title: "Repeated vomiting, fluid intolerance and severe abdominal pain",
        patient: patient("preview-aisha-patient", "Aisha Rahman", 38, "Female"),
        handoff: {
          situation: "Three days after a dose escalation to 1 mg, Aisha reported repeated vomiting, inability to keep water down and severe abdominal pain radiating to her back.",
          patient_report: "Vomited more than 5 times since yesterday. I cannot keep water down. The pain is severe and radiates to my back.",
          relevant_context: ["Dose escalated to 1 mg three days ago", "Patient submitted this at 02:47", "TrueSight told the patient to seek urgent medical care without waiting for chat"],
          requested_help: "Acknowledge this report and review the treatment timeline now.",
          evidence_ids: ["symptom-vomiting", "symptom-fluids", "symptom-pain"],
        },
        delivered_at: isoOffset(-45),
        acknowledgement_due_at: null,
        acknowledged_at: null,
        reviewed_at: null,
        resolved_at: null,
        escalated_at: isoOffset(-30),
        final_escalation_at: isoOffset(-15),
        escalation_count: 2,
        overdue: true,
      },
      {
        ...base,
        handoff_id: "preview-priority-omar",
        customer_id: "preview-omar",
        patient_id: "preview-omar-patient",
        subscription_id: "preview-omar-subscription",
        channel_id: "preview-omar-chat",
        message_id: "preview-omar-message",
        urgency: "PRIORITY",
        status: "DELIVERED",
        attention_state: "OVERDUE",
        title: "Weight trend changed despite recorded adherence",
        patient: patient("preview-omar-patient", "Omar Haddad", 41, "Male"),
        handoff: {
          situation: "Weight increased 1.8 kg across 12 days after a previous 6.1 kg loss. Omar reports stronger appetite and frustration.",
          patient_report: "My appetite is much stronger and I feel frustrated.",
          relevant_context: ["Dose confirmation was late on day 65", "Day 72 remains unconfirmed, not recorded as skipped", "Cause of the change is unknown"],
          requested_help: "Review whether the current treatment plan still fits.",
          evidence_ids: ["scale-trend-63-75", "check-in-day-74"],
        },
        delivered_at: isoOffset(-190),
        acknowledgement_due_at: isoOffset(-10),
        acknowledged_at: null,
        reviewed_at: null,
        resolved_at: null,
        escalated_at: isoOffset(-10),
        final_escalation_at: null,
        escalation_count: 1,
        overdue: true,
      },
      {
        ...base,
        handoff_id: "preview-routine-mariam",
        customer_id: "preview-mariam",
        patient_id: "preview-mariam-patient",
        subscription_id: "preview-mariam-subscription",
        channel_id: "preview-mariam-chat",
        message_id: "preview-mariam-message",
        urgency: "ROUTINE",
        status: "DELIVERED",
        attention_state: "AWAITING_ACKNOWLEDGEMENT",
        title: "Sustained weight plateau despite recorded adherence",
        patient: patient("preview-mariam-patient", "Mariam Saleh", 39, "Female"),
        handoff: {
          situation: "Weight has stayed around 81.5 kg for three weeks while the treatment record shows full adherence and no reported side effects.",
          patient_report: "No direct request. TrueSight prepared this review after a sustained plateau.",
          relevant_context: ["Weight changed by 0.1 kg over 21 days", "Dose adherence recorded at 100%", "No cause has been assigned"],
          requested_help: "Review the treatment response before the patient has to ask.",
          evidence_ids: ["weight-window-21d", "adherence-window-21d"],
        },
        delivered_at: isoOffset(-20),
        acknowledgement_due_at: isoOffset(100),
        acknowledged_at: null,
        reviewed_at: null,
        resolved_at: null,
        escalated_at: null,
        final_escalation_at: null,
        escalation_count: 0,
        overdue: false,
      },
    ],
  };
}

function initials(name) {
  return String(name || "Patient").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatTime(value) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Dubai",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function clockLabel(item, now) {
  if (item.status !== "DELIVERED") return item.status === "ACKNOWLEDGED" ? "Acknowledged" : item.status === "REVIEWED" ? "Reviewed" : "Resolved";
  if (item.attention_state === "FINAL_ESCALATION") return "Final escalation";
  if (item.overdue || item.attention_state === "OVERDUE" || item.attention_state === "ESCALATED") return "Acknowledgement overdue";
  if (!item.acknowledgement_due_at) return "Awaiting acknowledgement";
  const minutes = Math.max(0, Math.ceil((new Date(item.acknowledgement_due_at).getTime() - now) / 60_000));
  if (minutes < 60) return `Acknowledge in ${minutes}m`;
  return `Acknowledge in ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function statusCopy(item, readOnly = false) {
  if (item.attention_state === "FINAL_ESCALATION" && readOnly) return `This urgent task missed both acknowledgement clocks. It remains assigned to ${item.owner?.name || "the original clinician"}.`;
  if (item.attention_state === "FINAL_ESCALATION") return "This urgent task missed both acknowledgement clocks. It remains assigned to you until another clinician explicitly takes ownership.";
  if (item.attention_state === "ESCALATED" || item.attention_state === "OVERDUE") return "The first acknowledgement clock expired. TrueSight raised its visibility without telling the patient that a doctor reviewed it.";
  if (item.status === "ACKNOWLEDGED") return "You opened this task. The patient is not told it was reviewed until you mark it reviewed.";
  if (item.status === "REVIEWED") return "Clinical review is recorded. Resolve it after the care-team action is complete.";
  if (item.status === "RESOLVED") return "The care-team task is complete and retained in the audit trail.";
  return "This task is assigned to you and its acknowledgement clock is running.";
}

function TrueSightRow({ item, selected, now, onSelect }) {
  const { Avatar } = window.DD_UI;
  return (
    <button className={`ts-inbox-row ${selected ? "selected" : ""} ${item.urgency.toLowerCase()}`} onClick={() => onSelect(item.handoff_id)}>
      <span className="ts-inbox-rail" />
      <Avatar initials={initials(item.patient?.name)} name={item.patient?.name} size="sm" />
      <span className="ts-inbox-row-copy">
        <span className="ts-inbox-row-top">
          <strong>{item.patient?.name || "Patient"}</strong>
          <em>{clockLabel(item, now)}</em>
        </span>
        <b>{item.title}</b>
        <small>{[item.track_key === "weight-loss" ? "Weight Loss Rx" : "Peptide Protocol", formatTime(item.delivered_at)].filter(Boolean).join(" · ")}</small>
      </span>
    </button>
  );
}

function TrueSightDetail({ item, now, actionPending, onTransition, onOpenChat, readOnly }) {
  const { Avatar } = window.DD_UI;
  if (!item) {
    return <aside className="ts-inbox-detail ts-inbox-detail-empty"><strong>No task selected</strong><p>Select a TrueSight task to review its provenance, clock and next action.</p></aside>;
  }
  const handoff = item.handoff || {};
  const context = Array.isArray(handoff.relevant_context) ? handoff.relevant_context : [];
  const evidence = Array.isArray(handoff.evidence_ids) ? handoff.evidence_ids : [];
  const canAcknowledge = item.status === "DELIVERED";
  const canReview = item.status === "DELIVERED" || item.status === "ACKNOWLEDGED";
  const canResolve = item.status !== "RESOLVED";
  return (
    <aside className={`ts-inbox-detail ${item.attention_state === "FINAL_ESCALATION" ? "final" : ""}`}>
      <div className="ts-detail-patient">
        <Avatar initials={initials(item.patient?.name)} name={item.patient?.name} size="lg" />
        <div><h2>{item.patient?.name}</h2><p>{[item.patient?.age ? `${item.patient.age} years` : "", item.patient?.gender, item.track_key === "weight-loss" ? "Weight Loss Rx" : "Peptide Protocol"].filter(Boolean).join(" · ")}</p></div>
        <span className={`ts-urgency ${item.urgency.toLowerCase()}`}>{item.urgency}</span>
      </div>

      <div className={`ts-clock-card ${item.overdue ? "overdue" : ""}`}>
        <div><span>{item.attention_state.replaceAll("_", " ")}</span><strong>{clockLabel(item, now)}</strong></div>
        <p>{statusCopy(item, readOnly)}</p>
        <dl>
          <div><dt>Owner</dt><dd>{item.owner?.name || window.DD_DATA.DOCTOR.name}</dd></div>
          <div><dt>Assigned</dt><dd>{formatTime(item.assigned_at)}</dd></div>
          <div><dt>Escalations</dt><dd>{item.escalation_count || 0}</dd></div>
        </dl>
      </div>

      <section className="ts-report">
        <span>TrueSight clinical brief</span>
        <h3>{item.title}</h3>
        <div><strong>What happened</strong><p>{handoff.situation || "TrueSight prepared a clinical review from the patient timeline."}</p></div>
        <div><strong>Patient report</strong><p>{handoff.patient_report || "No direct patient statement was attached."}</p></div>
        {context.length ? <div><strong>Relevant context</strong><ul>{context.map((entry) => <li key={entry}>{entry}</li>)}</ul></div> : null}
        <div><strong>Decision requested</strong><p>{handoff.requested_help || "Review the timeline and decide the next care-team action."}</p></div>
      </section>

      <div className="ts-provenance">
        <span>Evidence</span>
        <strong>{evidence.length ? `${evidence.length} linked record${evidence.length === 1 ? "" : "s"}` : "No evidence identifiers attached"}</strong>
        <p>TrueSight preserves the source records and does not turn an unconfirmed event into a confirmed clinical fact.</p>
      </div>

      <div className="ts-detail-actions">
        {readOnly ? <p className="ts-escalation-owner-note">Assigned to {item.owner?.name || "the original clinician"}. Clinical administrators can see the missed clock without silently taking over clinical ownership.</p> : null}
        {!readOnly && canAcknowledge ? <button className="ts-primary" disabled={actionPending} onClick={() => onTransition(item, "ACKNOWLEDGED")}>{actionPending ? "Saving" : "Acknowledge"}</button> : null}
        {!readOnly && canReview ? <button className="ts-primary" disabled={actionPending} onClick={() => onTransition(item, "REVIEWED")}>Mark reviewed</button> : null}
        {!readOnly && canResolve ? <button className="ts-secondary" disabled={actionPending} onClick={() => onTransition(item, "RESOLVED")}>Resolve task</button> : null}
        <button className="ts-secondary" onClick={() => onOpenChat(item)}>Open patient chat</button>
      </div>
    </aside>
  );
}

function TrueSightInboxView({ onCountChange, onOpenChat }) {
  const { Topbar } = window.DD_UI;
  const [payload, setPayload] = useState(null);
  const [state, setState] = useState("OPEN");
  const [scope, setScope] = useState("ASSIGNED");
  const [urgency, setUrgency] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionPending, setActionPending] = useState("");
  const [now, setNow] = useState(Date.now());
  const [canViewEscalations, setCanViewEscalations] = useState(false);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const params = scope === "ESCALATIONS"
        ? new URLSearchParams({ limit: "100" })
        : new URLSearchParams({ doctor_id: DOCTOR_ID, state, limit: "100" });
      if (urgency && scope === "ASSIGNED") params.set("urgency", urgency);
      const endpoint = scope === "ESCALATIONS" ? "escalations" : "inbox";
      const next = await fetchJson(`${API_BASE}/doctor/truesight/${endpoint}?${params.toString()}`);
      setPayload(next);
      setCanViewEscalations(Boolean(next.capabilities?.can_view_escalations));
      setError("");
      setSelectedId((current) => next.items?.some((item) => item.handoff_id === current) ? current : next.items?.[0]?.handoff_id || "");
      onCountChange?.(next.summary?.open ?? null);
    } catch (requestError) {
      if (import.meta.env.VITE_SKIP_CLERK === "1" || import.meta.env.VITE_SKIP_CLERK === "true") {
        const preview = previewInbox();
        const previewItems = scope === "ESCALATIONS"
          ? preview.items.filter((item) => item.escalation_count > 0 && item.status === "DELIVERED")
          : preview.items.filter((item) =>
            (state === "OPEN" ? item.status === "DELIVERED" : item.status === state) &&
            (!urgency || item.urgency === urgency)
          );
        setPayload({ ...preview, items: previewItems, read_only: scope === "ESCALATIONS" });
        setCanViewEscalations(true);
        setSelectedId((current) => previewItems.some((item) => item.handoff_id === current) ? current : previewItems[0]?.handoff_id || "");
        setError("local-preview");
        onCountChange?.(preview.summary.open);
      } else {
        setError(requestError?.message || "Could not load TrueSight tasks.");
        onCountChange?.(null);
      }
    } finally {
      setLoading(false);
    }
  }, [onCountChange, scope, state, urgency]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      load({ quiet: true });
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const items = payload?.items || [];
  const selected = items.find((item) => item.handoff_id === selectedId) || items[0] || null;
  const summary = payload?.summary || {};

  const transition = async (item, status) => {
    setActionPending(status);
    if (error === "local-preview") {
      setPayload((current) => {
        if (!current) return current;
        const changed = current.items.map((entry) => entry.handoff_id === item.handoff_id
          ? {
              ...entry,
              status,
              attention_state: status,
              acknowledged_at: entry.acknowledged_at || (status !== "DELIVERED" ? new Date().toISOString() : null),
              reviewed_at: entry.reviewed_at || (["REVIEWED", "RESOLVED"].includes(status) ? new Date().toISOString() : null),
              resolved_at: status === "RESOLVED" ? new Date().toISOString() : entry.resolved_at,
            }
          : entry);
        return {
          ...current,
          items: state === status ? changed : changed.filter((entry) => entry.handoff_id !== item.handoff_id),
          summary: {
            ...current.summary,
            open: state === "OPEN" ? Math.max(0, Number(current.summary.open || 0) - 1) : current.summary.open,
            urgent: state === "OPEN" && item.urgency === "URGENT" ? Math.max(0, Number(current.summary.urgent || 0) - 1) : current.summary.urgent,
            overdue: state === "OPEN" && item.overdue ? Math.max(0, Number(current.summary.overdue || 0) - 1) : current.summary.overdue,
            acknowledged: status === "ACKNOWLEDGED" ? Number(current.summary.acknowledged || 0) + 1 : current.summary.acknowledged,
            reviewed: status === "REVIEWED" ? Number(current.summary.reviewed || 0) + 1 : current.summary.reviewed,
          },
        };
      });
      setSelectedId("");
      setActionPending("");
      return;
    }
    try {
      await fetchJson(`${API_BASE}/doctor/truesight/handoffs/${encodeURIComponent(item.handoff_id)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: DOCTOR_ID, status }),
      });
      await load({ quiet: true });
    } catch (requestError) {
      window.alert(requestError?.message || "Could not update this TrueSight task.");
    } finally {
      setActionPending("");
    }
  };

  return (
    <div className="screen ts-inbox-screen fade-in">
      <Topbar title="TrueSight Inbox" subtitle="Patient moments that need clinical ownership, not ordinary chat." />
      <div className="ts-inbox-summary">
        <div><span>Open</span><strong>{summary.open ?? "·"}</strong></div>
        <div className="urgent"><span>Urgent</span><strong>{summary.urgent ?? "·"}</strong></div>
        <div className="overdue"><span>Overdue</span><strong>{summary.overdue ?? "·"}</strong></div>
        <div><span>Acknowledged</span><strong>{summary.acknowledged ?? "·"}</strong></div>
        <div><span>Reviewed</span><strong>{summary.reviewed ?? "·"}</strong></div>
      </div>
      {error === "local-preview" ? <div className="ts-preview-note">{scope === "ESCALATIONS" ? "Local preview of the clinical-admin escalation queue." : "Local preview. Production loads only tasks assigned to the signed-in clinician."}</div> : error ? <div className="clinical-inbox-warning">{error}</div> : null}
      <div className="ts-inbox-toolbar">
        {canViewEscalations ? <div className="ts-scope-switch" aria-label="TrueSight inbox scope">
          <button className={scope === "ASSIGNED" ? "active" : ""} onClick={() => setScope("ASSIGNED")}>Assigned</button>
          <button className={scope === "ESCALATIONS" ? "active" : ""} onClick={() => setScope("ESCALATIONS")}>Escalations</button>
        </div> : null}
        <div>{FILTERS.map((filter) => <button key={filter.key} className={state === filter.key ? "active" : ""} onClick={() => setState(filter.key)}>{filter.label}</button>)}</div>
        {scope === "ASSIGNED" ? <select value={urgency} onChange={(event) => setUrgency(event.target.value)} aria-label="Filter by urgency">
          <option value="">All urgency</option><option value="URGENT">Urgent</option><option value="PRIORITY">Priority</option><option value="ROUTINE">Routine</option>
        </select> : <span className="ts-escalation-label">Missed acknowledgement clocks across all clinicians</span>}
      </div>
      <div className="ts-inbox-layout">
        <div className="ts-inbox-list">
          {loading && !payload ? <div className="clinical-inbox-empty">Loading assigned tasks...</div> : items.length ? items.map((item) => <TrueSightRow key={item.handoff_id} item={item} selected={selected?.handoff_id === item.handoff_id} now={now} onSelect={setSelectedId} />) : <div className="clinical-inbox-empty">No TrueSight tasks in this view.</div>}
        </div>
        <TrueSightDetail item={selected} now={now} actionPending={Boolean(actionPending)} onTransition={transition} onOpenChat={onOpenChat} readOnly={Boolean(payload?.read_only)} />
      </div>
    </div>
  );
}

window.DD_TrueSightInboxView = TrueSightInboxView;
