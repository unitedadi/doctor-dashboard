import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { fetchJson } from "../lib/authFetch.js";
import { StreamChat } from "stream-chat";
import {
  Channel,
  ChannelList,
  Chat,
  MessageComposer,
  MessageList,
  Thread,
  Window,
  useChatContext,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";

/* global React */
const { useEffect: useEffectC, useMemo: useMemoC, useState: useStateC } = React;

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function fetchChatToken() {
  return fetchJson(`${API_BASE}/doctor/chat/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doctor_id: DOCTOR_ID }),
  });
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapPatientForChannel(item) {
  const demographics = item.demographics || {};
  const assessment = item.assessment || {};
  return {
    id: item.id,
    customer_id: item.customer_id,
    name: item.name || "Unknown patient",
    initials: item.initials || "P",
    age: item.age,
    sex: titleCase(item.sex),
    phone: item.phone || item.customer_phone || "",
    email: item.email || "",
    address: item.address || "",
    demographics: {
      height_cm: demographics.height_cm ?? demographics.heightCm ?? assessment.basic?.height_cm,
      weight_kg: demographics.weight_kg ?? demographics.weightKg ?? assessment.basic?.weight_kg,
      bmi: demographics.bmi ?? assessment.basic?.bmi,
    },
    assessment: {
      basic: assessment.basic || {},
      submissions: asArray(assessment.submissions),
    },
    conditions: asArray(item.conditions),
    allergies: asArray(item.allergies),
    medications: asArray(item.medications),
    visit_history: asArray(item.visit_history || item.visitHistory),
    rx_prescription_history: asArray(item.rx_prescription_history || item.prescriptionHistory),
    delivered_medications: asArray(item.delivered_medications || item.deliveredMedications),
    refill_history: asArray(item.refill_history || item.refillHistory),
    track_key: item.track_key || item.trackKey || "",
  };
}

function channelMemberPatient(channel, currentUserId) {
  const members = Object.values(channel?.state?.members || {})
    .map((member) => member.user)
    .filter(Boolean);
  return members.find((user) => {
    const text = `${user.id || ""} ${user.name || ""}`.toLowerCase();
    return user.id !== currentUserId && !text.includes("doctor") && !text.includes("dardoc");
  }) || members.find((user) => user.id !== currentUserId);
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findChannelPatient(channel, currentUserId, patientDirectory = []) {
  const data = channel?.data || {};
  const memberPatient = channelMemberPatient(channel, currentUserId);
  const channelText = `${channel?.id || ""} ${channel?.cid || ""}`.toLowerCase();
  const dataPatient = data.patient && typeof data.patient === "object" ? data.patient : null;
  const patientId = data.patient_id || data.patientId || dataPatient?.id;
  const customerId = data.customer_id || data.customerId || dataPatient?.customer_id;

  const match = patientDirectory.find((patient) => {
    const name = normalizeName(patient.name);
    const memberName = normalizeName(memberPatient?.name);
    return (
      patient.id === patientId ||
      patient.customer_id === customerId ||
      patient.customer_id === memberPatient?.id ||
      (patient.customer_id && channelText.includes(String(patient.customer_id).toLowerCase())) ||
      (name && memberName && (name === memberName || name.includes(memberName) || memberName.includes(name)))
    );
  });
  return match || null;
}

function channelPatient(channel, currentUserId, patientDirectory = []) {
  const data = channel?.data || {};
  const memberPatient = channelMemberPatient(channel, currentUserId);
  const dataPatient = data.patient && typeof data.patient === "object" ? data.patient : null;
  const patientId = data.patient_id || data.patientId || dataPatient?.id;
  const customerId = data.customer_id || data.customerId || dataPatient?.customer_id;
  const match = findChannelPatient(channel, currentUserId, patientDirectory);
  if (match) return mapPatientForChannel(match);

  if (dataPatient) return mapPatientForChannel(dataPatient);

  return {
    id: patientId || "",
    customer_id: customerId || memberPatient?.id || "",
    name: memberPatient?.name || data.name || "Patient",
    initials: memberPatient?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "P",
    phone: data.phone || data.customer_phone || "",
    track_key: data.track_key || data.trackKey || "",
  };
}

function mapPrescribablePatient(item) {
  return {
    id: item.patient_id,
    customer_id: item.customer_id,
    name: item.name || "Unknown patient",
    initials: item.initials || "P",
    age: item.age,
    sex: titleCase(item.sex),
    track_key: item.track_key || "",
    can_prescribe: item.can_prescribe === true,
  };
}

function channelServiceName(channel, patientName) {
  const name = channel?.data?.name || "";
  return name && name !== patientName ? name : "Rx chat";
}

function latestMessage(channel) {
  const messages = channel?.state?.messages || [];
  return messages[messages.length - 1] || null;
}

function latestMessagePreview(channel, currentUserId) {
  const message = latestMessage(channel);
  if (!message) return "No messages yet";
  const author = message.user?.id === currentUserId ? "You" : message.user?.name || "Patient";
  const body = message.text || (message.attachments?.length ? "Attachment" : "Message");
  return `${author}: ${body}`;
}

function disabledReasonCopy(reason) {
  const copy = {
    completed_consultation_not_found: "Completed consultation required",
    subscription_inactive: "Subscription inactive",
    track_not_found: "Rx track missing",
  };
  return copy[reason] || "Prescription not available";
}

function formatTrackKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "weight-loss" || normalized === "weight_loss") return "Weight Loss Rx";
  if (normalized === "peptides" || normalized === "peptide") return "Peptides";
  if (normalized === "quickwlp" || normalized === "quick-wlp") return "Quick Consult";
  return value ? titleCase(value) : "Rx";
}

function formatSubscriptionStatus(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "TRIALING") return "Trial";
  if (normalized === "ACTIVE") return "Active";
  if (normalized === "PAST_DUE") return "Past due";
  if (normalized === "CANCELS_AT_PERIOD_END") return "Cancelling";
  if (normalized === "CANCELLED" || normalized === "CANCELED") return "Cancelled";
  return value ? titleCase(value) : "Not available";
}

function formatContextDateTime(value) {
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

function chatContextPatient(context, fallbackPatient) {
  return context?.patient ? mapPatientForChannel({ ...context.patient, track_key: context.rx?.track_key }) : fallbackPatient;
}

function compactPatientSubtitle(patient) {
  return [
    patient?.phone,
    patient?.age ? `${patient.age}y` : "",
    patient?.sex,
  ].filter(Boolean).join(" · ");
}

function clinicalFactList(patient) {
  const facts = [];
  if (Array.isArray(patient?.conditions) && patient.conditions.length) {
    facts.push({ label: "Conditions", value: patient.conditions.slice(0, 3).join(", ") });
  }
  if (Array.isArray(patient?.allergies) && patient.allergies.length) {
    facts.push({ label: "Allergies", value: patient.allergies.slice(0, 3).join(", ") });
  }
  if (Array.isArray(patient?.medications) && patient.medications.length) {
    facts.push({ label: "Medication", value: patient.medications.slice(0, 3).map(medicationName).join(", ") });
  }
  return facts;
}

function medicationName(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.name || item.title || item.itemLabel || "Medication";
}

function prescriptionTitle(item) {
  if (!item) return "Prescription";
  const items = asArray(item.items);
  if (items.length) {
    return items.map((line) => `${line.name || "Medication"}${line.quantity ? ` x${line.quantity}` : ""}`).join(", ");
  }
  return item.title || item.item_label || item.itemLabel || "Prescription";
}

function firstUsefulAssessmentAnswer(submission) {
  const answers = submission?.answers || {};
  const entry = Object.entries(answers).find(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== "";
  });
  if (!entry) return null;
  const [key, value] = entry;
  return {
    label: titleCase(key),
    value: Array.isArray(value) ? value.join(", ") : String(value),
  };
}

function valueOrText(value, fallback = "Not available") {
  return value || fallback;
}

function formatMedicationItems(items) {
  const lines = asArray(items);
  if (!lines.length) return "No medication items";
  return lines.map((line) => `${line.name || "Medication"}${line.quantity ? ` x${line.quantity}` : ""}`).join(", ");
}

function multilineToList(value) {
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberOrNull(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function prescriptionMeta(item) {
  return [
    item.status ? titleCase(item.status) : "",
    formatContextDateTime(item.issued_at || item.createdAt || item.created_at),
  ].filter(Boolean).join(" · ");
}

function deliveryMeta(item) {
  return [
    item.status ? titleCase(item.status) : "",
    item.delivered_at ? `Delivered ${formatContextDateTime(item.delivered_at)}` : "",
    !item.delivered_at && item.paid_at ? `Ordered ${formatContextDateTime(item.paid_at)}` : "",
  ].filter(Boolean).join(" · ");
}

function fetchChannelContext(channelId) {
  return fetchJson(`${API_BASE}/doctor/chat/channels/${encodeURIComponent(channelId)}/context?doctor_id=${DOCTOR_ID}`);
}

function fetchPatientFile(patientId) {
  return fetchJson(`${API_BASE}/doctor/patients/${encodeURIComponent(patientId)}/file?doctor_id=${DOCTOR_ID}`);
}

function updateClinicalProfile(patientId, body) {
  return fetchJson(`${API_BASE}/doctor/patients/${encodeURIComponent(patientId)}/clinical-profile?doctor_id=${DOCTOR_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mapPatientFileForPanel(patientFile, fallbackPatient) {
  if (!patientFile?.patient) return fallbackPatient;
  const clinical = patientFile.clinical || {};
  return {
    ...fallbackPatient,
    id: patientFile.patient.id || fallbackPatient?.id || "",
    customer_id: patientFile.patient.customer_id || fallbackPatient?.customer_id || "",
    name: patientFile.patient.name || fallbackPatient?.name || "Patient",
    initials: patientFile.patient.initials || fallbackPatient?.initials || "P",
    age: patientFile.patient.age ?? fallbackPatient?.age,
    sex: titleCase(patientFile.patient.sex || fallbackPatient?.sex),
    phone: patientFile.patient.phone || fallbackPatient?.phone || "",
    email: patientFile.patient.email || fallbackPatient?.email || "",
    address: patientFile.patient.address || fallbackPatient?.address || "",
    demographics: clinical.demographics || fallbackPatient?.demographics || {},
    assessment: clinical.assessment || fallbackPatient?.assessment || { basic: {}, submissions: [] },
    conditions: asArray(clinical.conditions || fallbackPatient?.conditions),
    allergies: asArray(clinical.allergies || fallbackPatient?.allergies),
    medications: asArray(clinical.current_medications || fallbackPatient?.medications),
    visit_history: asArray(patientFile.consultations).map((item) => ({
      id: item.id,
      date: item.scheduled_at,
      title: item.title,
      note: item.doctor_notes,
    })),
    rx_prescription_history: asArray(patientFile.prescriptions),
    delivered_medications: asArray(patientFile.medication_delivery),
    refill_history: asArray(patientFile.refills),
    track_key: patientFile.program?.track_keys?.[0] || fallbackPatient?.track_key || "",
  };
}

function ClinicalProfileModal({ patient, onClose, onSaved }) {
  const regularMedications = patient?.assessment?.basic?.regular_medications || "";
  const [draft, setDraft] = useStateC({
    height_cm: patient?.demographics?.height_cm ?? "",
    current_weight_kg: patient?.demographics?.weight_kg ?? "",
    allergies_text: asArray(patient?.allergies).join("\n"),
    conditions_text: asArray(patient?.conditions).join("\n"),
    regular_medications_text: regularMedications,
  });
  const [saving, setSaving] = useStateC(false);
  const [error, setError] = useStateC("");

  const setField = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    if (!patient?.id) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        height_cm: numberOrNull(draft.height_cm),
        current_weight_kg: numberOrNull(draft.current_weight_kg),
        allergies_json: { types: multilineToList(draft.allergies_text) },
        medical_conditions_json: { selected: multilineToList(draft.conditions_text) },
        regular_medications_text: String(draft.regular_medications_text || "").trim() || null,
      };
      const result = await updateClinicalProfile(patient.id, payload);
      onSaved(result.patient_file);
      onClose();
    } catch (err) {
      setError(err.message || "Could not update clinical profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="quickwlp-dialog-backdrop clinical-profile-dialog-backdrop">
      <div className="quickwlp-dialog clinical-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="clinical-profile-title">
        <div className="quickwlp-dialog-head">
          <div>
            <div id="clinical-profile-title" className="quickwlp-dialog-title">Update clinical profile</div>
            <p>Update doctor-editable facts only. Prescriptions, delivery, visits, and refills stay system generated.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Close</button>
        </div>

        <div className="clinical-profile-form">
          <label>
            <span>Height</span>
            <input
              inputMode="decimal"
              value={draft.height_cm}
              onChange={(event) => setField("height_cm", event.target.value)}
              placeholder="cm"
            />
          </label>
          <label>
            <span>Weight</span>
            <input
              inputMode="decimal"
              value={draft.current_weight_kg}
              onChange={(event) => setField("current_weight_kg", event.target.value)}
              placeholder="kg"
            />
          </label>
          <label>
            <span>Allergies</span>
            <textarea
              value={draft.allergies_text}
              onChange={(event) => setField("allergies_text", event.target.value)}
              placeholder="One per line"
            />
          </label>
          <label>
            <span>Conditions</span>
            <textarea
              value={draft.conditions_text}
              onChange={(event) => setField("conditions_text", event.target.value)}
              placeholder="One per line"
            />
          </label>
          <label className="clinical-profile-form-wide">
            <span>Current meds</span>
            <textarea
              value={draft.regular_medications_text}
              onChange={(event) => setField("regular_medications_text", event.target.value)}
              placeholder="Non-DarDoc medications or supplements"
            />
          </label>
        </div>

        {error ? <div className="quickwlp-dialog-error">{error}</div> : null}

        <div className="quickwlp-dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving" : "Save profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatChannelTime(channel) {
  const message = latestMessage(channel);
  const date = message?.created_at ? new Date(message.created_at) : channel?.data?.last_message_at ? new Date(channel.data.last_message_at) : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const dubaiDay = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeZone: "Asia/Dubai" });
  const today = dubaiDay.format(now);
  const value = dubaiDay.format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (value === today) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dubai" }).format(date);
  }
  if (value === dubaiDay.format(yesterday)) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Asia/Dubai" }).format(date);
}

function EmptyChatPanel() {
  return <div className="empty-state stream-chat-empty">Select a conversation to open chat.</div>;
}

function StreamChannelRows({ channels, patientDirectory }) {
  const { channel: activeChannel, client, setActiveChannel } = useChatContext("StreamChannelRows");

  return (
    <div className="stream-kit-row-list">
      {channels.map((item) => {
        const patient = channelPatient(item, client.userID, patientDirectory);
        const patientName = patient.name;
        const unread = item.countUnread?.() || 0;
        const isActive = item.cid === activeChannel?.cid;
        const service = channelServiceName(item, patientName);
        const track = patient.track_key || item?.data?.track_key || item?.data?.trackKey || "";

        return (
          <button
            key={item.cid}
            type="button"
            className={"stream-kit-row" + (isActive ? " active" : "") + (unread ? " unread" : "")}
            onClick={() => setActiveChannel(item)}
          >
            <span className="stream-kit-row-avatar">{patient.initials || "P"}</span>
            <span className="stream-kit-row-main">
              <span className="stream-kit-row-top">
                <span className="stream-kit-row-name">{patientName}</span>
                <span className="stream-kit-row-time">{formatChannelTime(item)}</span>
              </span>
              {patient.phone ? <span className="stream-kit-row-phone">{patient.phone}</span> : null}
              <span className="stream-kit-row-tags">
                <span>{formatTrackKey(track || service)}</span>
                {service && service !== "Rx chat" ? <span>{service}</span> : null}
              </span>
              <span className="stream-kit-row-preview">{latestMessagePreview(item, client.userID)}</span>
            </span>
            {unread ? <span className="stream-kit-row-badge">{unread}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function ClinicalStateStrip({ context, canPrescribe }) {
  const latestCompleted = context?.rx?.latest_completed_at;
  const steps = [
    {
      label: "Consult",
      state: latestCompleted ? "done" : "pending",
      value: latestCompleted ? formatContextDateTime(latestCompleted) : "Not completed",
    },
    {
      label: "Prescription",
      state: canPrescribe ? "ready" : "pending",
      value: canPrescribe ? "Ready" : disabledReasonCopy(context?.rx?.can_prescribe_reason),
    },
    {
      label: "Follow-up",
      state: "neutral",
      value: context?.patient?.phone ? "Chat open" : "Confirm details",
    },
  ];

  return (
    <div className="clinical-state-strip" aria-label="Clinical state">
      {steps.map((step) => (
        <div key={step.label} className={`clinical-state-step ${step.state}`}>
          <span className="clinical-state-dot" />
          <span className="clinical-state-copy">
            <span className="clinical-state-label">{step.label}</span>
            <span className="clinical-state-value">{step.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function ClinicalChatHeader({ channel, context, contextLoading, contextError, fallbackPatient, prescribablePatient, onOpenPatient, onPrescribe }) {
  const patient = chatContextPatient(context, fallbackPatient);
  const chartPatientId = context?.patient?.id || patient?.id || channel?.data?.patient_id || channel?.data?.patientId;
  const patientCustomerId = prescribablePatient?.customer_id || context?.patient?.customer_id || patient?.customer_id || channel?.data?.customer_id || channel?.data?.customerId;
  const service = channelServiceName(channel, patient?.name);
  const trackLabel = formatTrackKey(context?.rx?.track_key || patient?.track_key || channel?.data?.track_key || channel?.data?.trackKey || service);
  const latestCompletedAt = formatContextDateTime(context?.rx?.latest_completed_at);
  const meta = [
    compactPatientSubtitle(patient),
    trackLabel,
  ].filter(Boolean).join(" · ");
  const canOpenChart = context?.actions?.can_open_chart ?? Boolean(chartPatientId || patientCustomerId);
  const canPrescribe = context?.actions?.can_prescribe ?? Boolean(prescribablePatient?.can_prescribe);

  return (
    <div className="clinical-chat-header">
      <div className="clinical-chat-main">
        <div className="clinical-chat-avatar">{patient?.initials || "P"}</div>
        <div className="clinical-chat-identity">
          <div className="clinical-chat-name">{patient?.name || "Patient"}</div>
          <div className="clinical-chat-meta">
            {contextLoading ? "Checking Rx eligibility..." : contextError ? "Patient context from chat" : meta || "Patient context from chat"}
          </div>
        </div>
      </div>
      <div className="clinical-chat-header-center">
        <div className="clinical-memory-line">
          <strong>{trackLabel}</strong>
          <span>{latestCompletedAt ? `Last consult ${latestCompletedAt}` : "No completed consult found"}</span>
          <span>{canPrescribe ? "Prescription ready" : disabledReasonCopy(context?.rx?.can_prescribe_reason)}</span>
        </div>
      </div>
      <div className="clinical-chat-actions">
        <span className="clinical-chat-service">{trackLabel}</span>
        <button
          type="button"
          className="btn-ghost"
          disabled={!canOpenChart}
          title={canOpenChart ? "Open patient chart" : "Waiting for patient mapping from backend"}
          onClick={() => canOpenChart && onOpenPatient(chartPatientId, patientCustomerId)}
        >
          Patient
        </button>
      </div>
    </div>
  );
}

function ClinicalContextPanel({ channel, context, contextLoading, fallbackPatient, patientFile, patientFileLoading, prescribablePatient, onOpenPatient, onPatientFileUpdated, onPrescribe }) {
  const [editingProfile, setEditingProfile] = useStateC(false);
  const patient = mapPatientFileForPanel(patientFile, chatContextPatient(context, fallbackPatient));
  const service = channelServiceName(channel, patient?.name);
  const track = context?.rx?.track_key || patient?.track_key || channel?.data?.track_key || channel?.data?.trackKey || service;
  const patientId = prescribablePatient?.id || context?.actions?.prescribe_patient_id || patient?.id || channel?.data?.patient_id || channel?.data?.patientId;
  const chartPatientId = context?.patient?.id || patient?.id || channel?.data?.patient_id || channel?.data?.patientId;
  const patientCustomerId = prescribablePatient?.customer_id || context?.patient?.customer_id || patient?.customer_id || channel?.data?.customer_id || channel?.data?.customerId;
  const prescribeTrackKey = prescribablePatient?.track_key || context?.actions?.prescribe_track_key || context?.rx?.track_key || patient?.track_key || channel?.data?.track_key || channel?.data?.trackKey || "";
  const canOpenChart = context?.actions?.can_open_chart ?? Boolean(chartPatientId || patientCustomerId);
  const canPrescribe = context?.actions?.can_prescribe ?? Boolean(prescribablePatient?.can_prescribe);
  const latestCompletedAt = formatContextDateTime(context?.rx?.latest_completed_at);
  const facts = clinicalFactList(patient);
  const latestAssessment = patient.assessment?.submissions?.[0];
  const latestAssessmentAnswer = firstUsefulAssessmentAnswer(latestAssessment);
  const prescriptions = asArray(patient.rx_prescription_history);
  const deliveredMedications = asArray(patient.delivered_medications);
  const refills = asArray(patient.refill_history);
  const visits = asArray(patient.visit_history);
  const prescriptionState = canPrescribe ? "Ready to prescribe" : disabledReasonCopy(context?.rx?.can_prescribe_reason);
  const primaryAction = canPrescribe ? "Publish clinical prescription" : "Review patient file";

  return (
    <aside className="clinical-context-panel">
      <section className="clinical-context-hero">
        <span className="clinical-context-avatar">{patient?.initials || "P"}</span>
        <div>
          <h3>{patient?.name || "Patient"}</h3>
          <p>{compactPatientSubtitle(patient) || "Identity details not available"}</p>
        </div>
      </section>

      <section className="clinical-next-card">
        <span>Clinical next</span>
        <strong>{primaryAction}</strong>
        <p>{prescriptionState}</p>
      </section>

      <section className="clinical-context-recall">
        <div>
          <span>Program</span>
          <strong>{formatTrackKey(track)}</strong>
        </div>
        <div>
          <span>Membership</span>
          <strong>{formatSubscriptionStatus(context?.rx?.subscription_status)}</strong>
        </div>
        <div>
          <span>Last consult</span>
          <strong>{contextLoading || patientFileLoading ? "Checking" : latestCompletedAt || "Not completed"}</strong>
        </div>
        <div>
          <span>Prescription</span>
          <strong>{prescriptionState}</strong>
        </div>
      </section>

      <section className="clinical-context-section">
        <h4>Patient dossier</h4>
        <div className="clinical-context-grid">
          <div className="clinical-context-row">
            <span>Phone</span>
            <strong>{valueOrText(patient.phone)}</strong>
          </div>
          <div className="clinical-context-row">
            <span>Email</span>
            <strong>{valueOrText(patient.email)}</strong>
          </div>
          <div className="clinical-context-row">
            <span>Member</span>
            <strong>{[patient.age ? `${patient.age}y` : "", patient.sex].filter(Boolean).join(" · ") || "Not available"}</strong>
          </div>
          <div className="clinical-context-row">
            <span>Address</span>
            <strong>{valueOrText(patient.address)}</strong>
          </div>
        </div>
      </section>

      <section className="clinical-context-section">
        <div className="clinical-section-head">
          <h4>Clinical profile</h4>
          <button type="button" onClick={() => setEditingProfile(true)}>Update</button>
        </div>
        <div className="clinical-context-grid">
          <div className="clinical-context-row">
            <span>Height / weight</span>
            <strong>{[
              patient.demographics?.height_cm ? `${patient.demographics.height_cm} cm` : "",
              patient.demographics?.weight_kg ? `${patient.demographics.weight_kg} kg` : "",
            ].filter(Boolean).join(" · ") || "Not provided"}</strong>
          </div>
          <div className="clinical-context-row">
            <span>BMI</span>
            <strong>{patient.demographics?.bmi || "Not provided"}</strong>
          </div>
          <div className="clinical-context-row">
            <span>Allergies</span>
            <strong>{patient.allergies?.length ? patient.allergies.join(", ") : "None reported"}</strong>
          </div>
          <div className="clinical-context-row">
            <span>Conditions</span>
            <strong>{patient.conditions?.length ? patient.conditions.join(", ") : "None reported"}</strong>
          </div>
          <div className="clinical-context-row">
            <span>Current meds</span>
            <strong>{patient.medications?.length ? patient.medications.map(medicationName).join(", ") : "None listed"}</strong>
          </div>
          <div className="clinical-context-row">
            <span>Assessment</span>
            <strong>{latestAssessment?.submitted_at ? formatContextDateTime(latestAssessment.submitted_at) : "Not available"}</strong>
          </div>
        </div>
        {latestAssessmentAnswer ? (
          <div className="clinical-context-note">
            <span>{latestAssessmentAnswer.label}</span>
            <strong>{latestAssessmentAnswer.value}</strong>
          </div>
        ) : null}
      </section>

      {facts.length ? (
        <section className="clinical-context-section">
          <h4>Known clinical facts</h4>
          <div className="clinical-context-grid">
            {facts.map((fact) => (
              <div className="clinical-context-row" key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="clinical-context-section">
        <h4>Prescriptions</h4>
        {prescriptions.length ? prescriptions.slice(0, 6).map((item, index) => (
          <div className="clinical-file-item" key={item.id || index}>
            <strong>{prescriptionTitle(item)}</strong>
            <span>{prescriptionMeta(item) || "Prescription details not available"}</span>
          </div>
        )) : <p className="clinical-file-empty">No prescription history found.</p>}
      </section>

      <section className="clinical-context-section">
        <h4>Medication and delivery</h4>
        {deliveredMedications.length ? deliveredMedications.slice(0, 5).map((item, index) => (
          <div className="clinical-file-item" key={item.order_id || index}>
            <strong>{formatMedicationItems(item.items)}</strong>
            <span>{deliveryMeta(item) || "Delivery status not available"}</span>
          </div>
        )) : <p className="clinical-file-empty">No delivered medication found.</p>}
      </section>

      <section className="clinical-context-section">
        <h4>Visit history</h4>
        {visits.length ? visits.slice(0, 6).map((item, index) => (
          <div className="clinical-file-item" key={item.id || index}>
            <strong>{item.title || "Visit"}</strong>
            <span>{[formatContextDateTime(item.date) || item.date, item.note].filter(Boolean).join(" · ")}</span>
          </div>
        )) : <p className="clinical-file-empty">No visit history found.</p>}
      </section>

      <section className="clinical-context-section">
        <h4>Refill history</h4>
        {refills.length ? refills.slice(0, 6).map((item, index) => (
          <div className="clinical-file-item" key={item.id || index}>
            <strong>{formatSubscriptionStatus(item.status || "Refill")}</strong>
            <span>{formatContextDateTime(item.submitted_at || item.reviewed_at) || "Date not available"}</span>
          </div>
        )) : <p className="clinical-file-empty">No refill history found.</p>}
      </section>

      <section className="clinical-context-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={!canPrescribe}
          onClick={() => canPrescribe && onPrescribe(patientId, prescribeTrackKey, patientCustomerId)}
        >
          Prescribe
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!canOpenChart}
          onClick={() => canOpenChart && onOpenPatient(chartPatientId, patientCustomerId)}
        >
          Open patient
        </button>
      </section>

      {editingProfile ? (
        <ClinicalProfileModal
          patient={patient}
          onClose={() => setEditingProfile(false)}
          onSaved={onPatientFileUpdated}
        />
      ) : null}
    </aside>
  );
}

function StreamConversation({ onOpenPatient, onPrescribe, patientDirectory, prescribableDirectory }) {
  const { channel, client } = useChatContext("StreamConversation");
  const fallbackPatient = channelPatient(channel, client.userID, patientDirectory);
  const directoryPrescribablePatient = findChannelPatient(channel, client.userID, prescribableDirectory);
  const [activePrescribablePatient, setActivePrescribablePatient] = useStateC(null);
  const [channelContext, setChannelContext] = useStateC(null);
  const [contextLoading, setContextLoading] = useStateC(false);
  const [contextError, setContextError] = useStateC("");
  const [patientFile, setPatientFile] = useStateC(null);
  const [patientFileLoading, setPatientFileLoading] = useStateC(false);

  const prescribablePatient = activePrescribablePatient || directoryPrescribablePatient;
  const patientFileId = channelContext?.patient?.id || fallbackPatient?.id || channel?.data?.patient_id || channel?.data?.patientId || "";

  useEffectC(() => {
    let cancelled = false;
    const loadPrescribablePatient = async () => {
      if (!channel?.id) {
        setActivePrescribablePatient(null);
        return;
      }
      try {
        const fallbackPatient = channelPatient(channel, client.userID);
        const params = new URLSearchParams({
          doctor_id: DOCTOR_ID,
          limit: fallbackPatient?.id || fallbackPatient?.customer_id ? "10" : "100",
          offset: "0",
        });
        if (fallbackPatient?.id) params.set("patient_id", fallbackPatient.id);
        if (fallbackPatient?.customer_id) params.set("customer_id", fallbackPatient.customer_id);
        const data = await fetchJson(`${API_BASE}/doctor/rx/prescribable-patients?${params.toString()}`);
        const mappedPatients = (data.patients || []).map(mapPrescribablePatient);
        if (!cancelled) {
          const exactMatch = fallbackPatient?.id || fallbackPatient?.customer_id ? mappedPatients[0] || null : null;
          setActivePrescribablePatient(exactMatch || findChannelPatient(channel, client.userID, mappedPatients) || null);
        }
      } catch {
        if (!cancelled) setActivePrescribablePatient(null);
      }
    };

    loadPrescribablePatient();
    return () => { cancelled = true; };
  }, [channel?.id, client.userID]);

  useEffectC(() => {
    let cancelled = false;
    const loadContext = async () => {
      if (!channel?.id) {
        setChannelContext(null);
        setContextError("");
        return;
      }
      setContextLoading(true);
      setContextError("");
      try {
        const data = await fetchChannelContext(channel.id);
        if (!cancelled) setChannelContext(data);
      } catch (err) {
        if (!cancelled) {
          setChannelContext(null);
          setContextError(err.message || "channel_context_unavailable");
        }
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    };

    loadContext();
    return () => { cancelled = true; };
  }, [channel?.id]);

  useEffectC(() => {
    let cancelled = false;
    const loadPatientFile = async () => {
      if (!patientFileId) {
        setPatientFile(null);
        return;
      }
      setPatientFileLoading(true);
      try {
        const data = await fetchPatientFile(patientFileId);
        if (!cancelled) setPatientFile(data);
      } catch {
        if (!cancelled) setPatientFile(null);
      } finally {
        if (!cancelled) setPatientFileLoading(false);
      }
    };

    loadPatientFile();
    return () => { cancelled = true; };
  }, [patientFileId]);

  if (!channel) return <EmptyChatPanel />;

  return (
    <div className="stream-kit-conversation">
      <Channel channel={channel}>
        <div className="stream-kit-chat-workspace">
          <div className="stream-kit-thread-pane">
            <Window>
              <div className="stream-kit-header">
                <ClinicalChatHeader
                  channel={channel}
                  context={channelContext}
                  contextError={contextError}
                  contextLoading={contextLoading}
                  fallbackPatient={fallbackPatient}
                  onOpenPatient={onOpenPatient}
                  onPrescribe={onPrescribe}
                  prescribablePatient={prescribablePatient}
                />
              </div>
              <MessageList />
              <MessageComposer focus />
            </Window>
            <Thread />
          </div>
          <ClinicalContextPanel
            channel={channel}
            context={channelContext}
            contextLoading={contextLoading}
            fallbackPatient={fallbackPatient}
            onOpenPatient={onOpenPatient}
            onPatientFileUpdated={setPatientFile}
            onPrescribe={onPrescribe}
            patientFile={patientFile}
            patientFileLoading={patientFileLoading}
            prescribablePatient={prescribablePatient}
          />
        </div>
      </Channel>
    </div>
  );
}

function ChatView({ initialPatientId, onOpenPatient, onPrescribe }) {
  const { Topbar } = window.DD_UI;
  const [client, setClient] = useStateC(null);
  const [initialChannelId, setInitialChannelId] = useStateC("");
  const [patientDirectory, setPatientDirectory] = useStateC([]);
  const [prescribableDirectory, setPrescribableDirectory] = useStateC([]);
  const [loading, setLoading] = useStateC(true);
  const [error, setError] = useStateC("");
  const loadIdRef = React.useRef(0);

  const loadChat = React.useCallback(async () => {
    const loadId = loadIdRef.current + 1;
    loadIdRef.current = loadId;
    setLoading(true);
    setError("");
    try {
      const token = await fetchChatToken();
      const streamClient = new StreamChat(token.api_key, { timeout: 15000 });

      let currentUserToken = token.user_token;
      const tokenProvider = async () => {
        if (currentUserToken) {
          const nextToken = currentUserToken;
          currentUserToken = "";
          return nextToken;
        }
        const refreshed = await fetchChatToken();
        return refreshed.user_token;
      };

      await streamClient.connectUser({ id: token.user_id, name: token.user.name }, tokenProvider);

      const patientsPayload = await fetchJson(`${API_BASE}/doctor/dashboard/patients?doctor_id=${DOCTOR_ID}`).catch(() => ({ patients: [] }));
      const patients = patientsPayload.patients || [];
      setPatientDirectory(patients);
      const prescribablePayload = await fetchJson(`${API_BASE}/doctor/rx/prescribable-patients?doctor_id=${DOCTOR_ID}&limit=100&offset=0`).catch(() => ({ patients: [] }));
      setPrescribableDirectory((prescribablePayload.patients || []).map(mapPrescribablePatient));

      if (initialPatientId) {
        const patient = patients.find((item) => item.id === initialPatientId);
        if (patient?.chat?.available && patient.customer_id) {
          const opened = await fetchJson(`${API_BASE}/doctor/chat/channels`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              doctor_id: DOCTOR_ID,
              patient_id: patient.id,
              customer_id: patient.customer_id,
            }),
          });
          setInitialChannelId(opened.channel_id || "");

          const createdChannel = streamClient.channel(opened.channel_type, opened.channel_id, {
            name: patient.name,
            patient_id: patient.id,
            patient: mapPatientForChannel(patient),
          });
          await createdChannel.watch().catch(() => {});
        }
      }

      if (loadId !== loadIdRef.current) {
        await streamClient.disconnectUser().catch(() => {});
        return null;
      }

      setClient(streamClient);
      return streamClient;
    } catch (err) {
      if (loadId === loadIdRef.current) setError(err.message || "Could not connect GetStream chat.");
      return null;
    } finally {
      if (loadId === loadIdRef.current) setLoading(false);
    }
  }, [initialPatientId]);

  useEffectC(() => {
    let connectedClient = null;
    let cancelled = false;

    loadChat().then((streamClient) => {
      if (!cancelled) connectedClient = streamClient;
      else if (streamClient) streamClient.disconnectUser().catch(() => {});
    });

    return () => {
      cancelled = true;
      loadIdRef.current += 1;
      if (connectedClient) connectedClient.disconnectUser().catch(() => {});
    };
  }, [loadChat]);

  const channelFilters = useMemoC(() => {
    if (!client?.userID) return {};
    return {
      type: "messaging",
      members: { $in: [client.userID] },
    };
  }, [client]);

  const channelSort = useMemoC(() => ({ last_message_at: -1 }), []);
  const channelOptions = useMemoC(() => ({ limit: 30, presence: true, state: true, watch: true }), []);
  const renderChannels = React.useCallback((channels) => <StreamChannelRows channels={channels} patientDirectory={patientDirectory} />, [patientDirectory]);

  return (
    <>
      <Topbar
        title="Messages"
        subtitle={loading ? "Connecting to GetStream" : "Powered by GetStream"}
      />

      {error && (
        <div className="api-state chat-api-state">
          <span>{error}</span>
          <button type="button" className="btn-ghost" onClick={loadChat}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="empty-state stream-chat-empty">Connecting to GetStream...</div>
      ) : client ? (
        <div className="stream-chat-shell stream-chat-kit-shell">
          <Chat client={client} theme="str-chat__theme-light">
            <div className="stream-kit-layout">
              <div className="stream-kit-list">
                <ChannelList
                  customActiveChannel={initialChannelId || undefined}
                  filters={channelFilters}
                  options={channelOptions}
                  renderChannels={renderChannels}
                  setActiveChannelOnMount
                  showChannelSearch
                  sort={channelSort}
                />
              </div>
              <StreamConversation
                onOpenPatient={onOpenPatient}
                onPrescribe={onPrescribe}
                patientDirectory={patientDirectory}
                prescribableDirectory={prescribableDirectory}
              />
            </div>
          </Chat>
        </div>
      ) : (
        <EmptyChatPanel />
      )}
    </>
  );
}

window.DD_ChatView = ChatView;
