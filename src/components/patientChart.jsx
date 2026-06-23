import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { fetchJson } from "../lib/authFetch.js";

/* global React */
const { useEffect: useEffectPC, useMemo: useMemoPC, useState: useStatePC } = React;

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(date);
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

function formatMoneyFils(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return `AED ${(amount / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function trackLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "weight-loss" || normalized === "weight_loss") return "Weight Loss Rx";
  if (normalized === "peptides") return "Peptides";
  if (normalized === "quickwlp" || normalized === "quick-wlp") return "Quick Consult";
  return value ? titleCase(value) : "Rx";
}

function actorRoleLabel(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Clinical team";
  if (normalized === "SUPER_ADMIN") return "Super admin";
  if (normalized === "CLINICAL_ADMIN") return "Clinical admin";
  return titleCase(normalized);
}

function itemLabel(items) {
  return asArray(items)
    .map((item) => `${item.name || item.title || "Medication"}${Number(item.quantity || 1) > 1 ? ` x${Number(item.quantity || 1)}` : ""}`)
    .join(", ");
}

function fetchPatientChart(patientId) {
  return fetchJson(`${API_BASE}/doctor/patients/${encodeURIComponent(patientId)}/chart?doctor_id=${DOCTOR_ID}`);
}

function createDoctorNote(patientId, body) {
  return fetchJson(`${API_BASE}/doctor/patients/${encodeURIComponent(patientId)}/notes?doctor_id=${DOCTOR_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function updateClinicalProfile(patientId, body) {
  return fetchJson(`${API_BASE}/doctor/patients/${encodeURIComponent(patientId)}/clinical-profile?doctor_id=${DOCTOR_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function numberOrNull(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function multilineToList(value) {
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function humanizeAnswerKey(value) {
  return String(value || "")
    .replace(/^q[_-]?\d+[_-]?/i, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Answer";
}

function humanizeAnswerValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) {
    return value.map(humanizeAnswerValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, entry]) => {
        const rendered = humanizeAnswerValue(entry);
        return rendered ? `${humanizeAnswerKey(key)}: ${rendered}` : "";
      })
      .filter(Boolean)
      .join(" · ");
  }
  const raw = String(value).trim();
  if (!raw) return "";
  return raw
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function assessmentKindLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "weight-loss" || normalized === "weight_loss") return "Weight Loss";
  if (normalized === "peptides") return "Peptides";
  if (normalized === "generic") return "Generic";
  return value ? humanizeAnswerKey(value) : "Assessment";
}

function assessmentAnswerPairs(submission) {
  return Object.entries(submission?.answers || {})
    .map(([key, value]) => ({
      key,
      label: humanizeAnswerKey(key),
      value: humanizeAnswerValue(value),
    }))
    .filter((item) => item.value)
    .slice(0, 12);
}

function EmptyInline({ children }) {
  return <div className="inline-empty">{children}</div>;
}

function ChartSection({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`patient-chart-section ${className}`.trim()}>
      <div className="patient-chart-section-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChartFact({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="patient-chart-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function chartPatientActionPayload(chart) {
  const patient = chart?.patient || {};
  return {
    id: patient.id || "",
    customerId: patient.customer_id || "",
    customer_id: patient.customer_id || "",
    name: patient.name || "Patient",
    phone: patient.phone || "",
    email: patient.email || "",
  };
}

function primaryTrack(chart) {
  return chart?.program?.track_keys?.[0] || chart?.prescriptions?.[0]?.track_key || "weight-loss";
}

function prescriptionStatusLabel(prescription) {
  const status = String(prescription?.status || "").toUpperCase();
  if (status === "PUBLISHED") return "Issued, unpaid";
  if (status === "ACTIVE") return "Active";
  if (status === "SUPERSEDED") return "Re-issued";
  return titleCase(prescription?.status || "Issued");
}

function medicationStatusLabel(delivery) {
  if (delivery?.delivered_at) return "Delivered";
  if (delivery?.paid_at) return "Paid";
  return titleCase(delivery?.status || "Medication order");
}

function consultationStatus(consultation) {
  const status = String(consultation?.status || consultation?.consultation_status || "").toUpperCase();
  if (status === "NO_SHOW" || status === "NO SHOW") return "no_show";
  if (
    consultation?.completed_at ||
    consultation?.completedAt ||
    status === "COMPLETED" ||
    status === "COMPLETE" ||
    status === "CONSULTATION_COMPLETED"
  ) return "completed";
  if (consultation?.scheduled_at) return "scheduled";
  return "none";
}

function consultationCompleted(consultation) {
  return consultationStatus(consultation) === "completed";
}

function chartHasCompletedConsult(chart) {
  return asArray(chart?.consultations).some(consultationCompleted);
}

function chartHasPaidMedication(chart) {
  return asArray(chart?.medication_delivery).some((delivery) => Boolean(delivery?.paid_at || delivery?.delivered_at));
}

function pendingRefill(chart) {
  return asArray(chart?.refills).find((refill) => String(refill?.status || "").toUpperCase() === "PENDING_REVIEW") || null;
}

function contextCanPrescribe(context) {
  return Boolean(context?.prescribable?.canPrescribe || context?.prescribable?.can_prescribe);
}

function contextCompletedAt(context) {
  return context?.prescribable?.latestCompletedAt || context?.prescribable?.latest_completed_at || "";
}

function prescriptionActionForChart({ chart, context, medication, amendablePrescription }) {
  const canPrescribe = contextCanPrescribe(context);
  if (amendablePrescription) {
    return { label: "Re-issue prescription", mode: "reissue", enabled: true, prescription: amendablePrescription };
  }
  if (!canPrescribe) return null;
  if (pendingRefill(chart)) return { label: "Review refill", mode: "refill", enabled: true };
  if (chartHasPaidMedication(chart) || medication) return { label: "Follow-up prescription", mode: "followup", enabled: true };
  if (chartHasCompletedConsult(chart)) return { label: "Issue prescription", mode: "issue", enabled: true };
  return null;
}

function buildLifecycle(chart, context = {}) {
  const taskCategory = String(context?.task?.category || "").toLowerCase();
  const canPrescribe = contextCanPrescribe(context);
  const consultation = chart?.consultations?.[0];
  const prescription = chart?.prescriptions?.[0];
  const delivery = chart?.medication_delivery?.[0];
  const refill = chart?.refills?.[0];
  const prescriptionStatus = String(prescription?.status || "").toUpperCase();
  let consultState = consultationStatus(consultation);
  let consultMeta = consultation?.completed_at || consultation?.no_show_at || consultation?.scheduled_at;
  if (canPrescribe || taskCategory === "needs_prescription" || taskCategory === "refill_review") {
    consultState = "completed";
    consultMeta = context?.task?.occurredAt || contextCompletedAt(context) || consultMeta;
  }
  if (taskCategory === "message_needs_response" && consultState === "none") {
    consultMeta = context?.task?.occurredAt || consultMeta;
  }
  const delivered = Boolean(delivery?.delivered_at);
  const paid = Boolean(delivery?.paid_at || delivery?.order_id);
  const issued = Boolean(prescription?.issued_at || prescription?.id);
  const refillPending = String(refill?.status || "").toUpperCase() === "PENDING_REVIEW";

  return [
    {
      label: "Consult",
      meta: consultState === "completed"
        ? formatDateTime(consultMeta) || "Completed"
        : consultState === "no_show"
          ? formatDateTime(consultMeta) || "No-show"
          : consultMeta
            ? formatDateTime(consultMeta)
            : "Not scheduled",
      state: consultState === "no_show" ? "risk" : consultState === "completed" ? "done" : consultState === "scheduled" ? "current" : "pending",
    },
    {
      label: issued ? "Rx issued" : "Rx not issued",
      meta: issued
        ? formatDateTime(prescription?.issued_at) || prescriptionStatusLabel(prescription)
        : consultState === "completed"
          ? "Doctor decision needed"
          : consultState === "no_show"
            ? "No-show"
            : "Waiting for consult",
      state: issued ? "done" : consultState === "completed" ? "current" : "pending",
    },
    {
      label: "Payment",
      meta: paid ? formatDateTime(delivery?.paid_at) || "Paid" : issued ? "Issued but unpaid" : "Not started",
      state: paid ? "done" : issued ? "current" : "pending",
    },
    {
      label: "Delivery",
      meta: delivered ? formatDateTime(delivery?.delivered_at) : paid ? "Awaiting delivery" : "Not delivered",
      state: delivered ? "done" : paid ? "current" : "pending",
    },
    {
      label: "Follow-up",
      meta: refillPending
        ? formatDateTime(refill?.submitted_at) || "Review due"
        : delivered
          ? "Track next clinical need"
          : consultState === "no_show"
            ? "Rebook if needed"
            : "Not due",
      state: refillPending ? "current" : "pending",
    },
  ];
}

function currentCareState({ chart, context, nextAction, medication, latestPrescription, latestDelivery }) {
  const consultation = asArray(chart?.consultations)[0];
  const taskCategory = String(context?.task?.category || "").toLowerCase();
  const canPrescribe = contextCanPrescribe(context);
  const nextActionLabel = String(nextAction?.label || "").trim();
  const nextActionIsNoop = !nextActionLabel || nextActionLabel.toLowerCase() === "no doctor action needed";
  const consultState = canPrescribe || taskCategory === "needs_prescription" || taskCategory === "refill_review"
    ? "completed"
    : consultationStatus(consultation);
  const issued = Boolean(latestPrescription?.issued_at || latestPrescription?.id);
  const paid = Boolean(latestDelivery?.paid_at || latestDelivery?.order_id);
  const delivered = Boolean(latestDelivery?.delivered_at);
  const refill = pendingRefill(chart);

  if (refill) return "Refill review due";
  if (delivered) return "Medication delivered";
  if (paid) return "Paid, awaiting delivery";
  if (issued) return "Prescription issued, unpaid";
  if (canPrescribe) return "Ready for prescription";
  if (!nextActionIsNoop) return nextActionLabel;
  if (consultState === "completed") return "Ready for prescription";
  if (consultState === "no_show") return "No-show";
  if (consultState === "scheduled") return "Consult scheduled";
  if (medication) return "On treatment";
  return "No doctor action needed";
}

function CareStatePanel({
  chart,
  context,
  nextAction,
  medication,
  latestPrescription,
  latestDelivery,
}) {
  const state = currentCareState({ chart, context, nextAction, medication, latestPrescription, latestDelivery });
  return (
    <section className="patient-care-state-panel">
      <div className="patient-care-state-primary">
        <span>Current care state</span>
        <strong>{state}</strong>
      </div>
      <div className="patient-care-state-grid">
        <ChartFact label="Medication" value={medication?.name || itemLabel(latestPrescription?.items) || "Not listed"} />
        <ChartFact label="Prescription" value={latestPrescription ? prescriptionStatusLabel(latestPrescription) : "Not issued"} />
        <ChartFact label="Payment" value={latestDelivery?.paid_at ? "Paid" : latestPrescription ? "Unpaid" : "Not started"} />
        <ChartFact label="Delivery" value={latestDelivery ? medicationStatusLabel(latestDelivery) : "No paid order"} />
      </div>
    </section>
  );
}

function PrescriptionGuardrails({
  clinical,
  medication,
  latestPrescription,
  latestDelivery,
}) {
  const allergies = asArray(clinical?.allergies);
  const conditions = asArray(clinical?.conditions);
  const activeMedication = medication?.name || asArray(clinical?.current_medications)[0]?.name || "";
  const prescriptionItems = itemLabel(latestPrescription?.items);
  const deliveryStatusText = latestDelivery
    ? `${medicationStatusLabel(latestDelivery)}${latestDelivery.delivered_at || latestDelivery.paid_at ? ` · ${formatDate(latestDelivery.delivered_at || latestDelivery.paid_at)}` : ""}`
    : "No paid medication order";

  const rows = [
    {
      label: "Allergies",
      value: allergies.length ? allergies.join(", ") : "None reported",
      tone: allergies.length ? "warn" : "clear",
    },
    {
      label: "Conditions",
      value: conditions.length ? conditions.join(", ") : "None reported",
      tone: conditions.length ? "warn" : "clear",
    },
    {
      label: "Current medication",
      value: activeMedication || "Not listed",
      tone: activeMedication ? "review" : "clear",
    },
    {
      label: "Last prescription",
      value: latestPrescription
        ? [prescriptionStatusLabel(latestPrescription), prescriptionItems, formatDate(latestPrescription.issued_at)].filter(Boolean).join(" · ")
        : "No prescription history",
      tone: latestPrescription ? "review" : "clear",
    },
    {
      label: "Medication order",
      value: deliveryStatusText,
      tone: latestDelivery?.paid_at && !latestDelivery?.delivered_at ? "warn" : latestDelivery ? "review" : "clear",
    },
  ];

  return (
    <ChartSection title="Prescription guardrails" subtitle="Check these before issuing or re-issuing." className="patient-guardrails-section">
      <div className="patient-guardrail-list">
        {rows.map((row) => (
          <div key={row.label} className={`patient-guardrail-row ${row.tone}`}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </ChartSection>
  );
}

function AssessmentReader({ assessment }) {
  const submissions = asArray(assessment?.submissions);
  const latest = submissions[0];
  const pairs = assessmentAnswerPairs(latest);
  const basic = assessment?.basic || {};

  return (
    <ChartSection title="Assessment answers" subtitle="Latest intake answers in readable clinical language." className="patient-assessment-section">
      {latest ? (
        <>
          <div className="patient-assessment-head">
            <div>
              <strong>{assessmentKindLabel(latest.kind || latest.track_key)}</strong>
              <span>{[latest.submitted_at ? formatDateTime(latest.submitted_at) : "", latest.template_version ? `Version ${latest.template_version}` : ""].filter(Boolean).join(" · ")}</span>
            </div>
            {submissions.length > 1 ? <em>{submissions.length} submissions</em> : null}
          </div>
          {pairs.length ? (
            <div className="patient-assessment-grid">
              {pairs.map((item) => (
                <div key={item.key}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyInline>No detailed answers available for the latest assessment.</EmptyInline>
          )}
        </>
      ) : (
        <div className="patient-assessment-grid">
          <div><span>Body shape</span><strong>{humanizeAnswerValue(basic.body_shape) || "Not provided"}</strong></div>
          <div><span>Activity</span><strong>{humanizeAnswerValue(basic.activity_level) || "Not provided"}</strong></div>
          <div><span>Pregnancy</span><strong>{humanizeAnswerValue(basic.pregnancy_status) || "Not provided"}</strong></div>
          <div><span>Breastfeeding</span><strong>{humanizeAnswerValue(basic.breastfeeding_status) || "Not provided"}</strong></div>
        </div>
      )}
    </ChartSection>
  );
}

function RxLifecycleStrip({ steps }) {
  return (
    <div className="rx-lifecycle-strip patient-lifecycle-strip">
      {steps.map((step) => (
        <div key={step.label} className={`rx-lifecycle-step ${step.state}`}>
          <span className="workbench-check-dot" />
          <div>
            <strong>{step.label}</strong>
            <em>{step.meta || (step.state === "pending" ? "Pending" : "Complete")}</em>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompactLifecycle({ steps }) {
  return (
    <div className="appointment-clinical-lifecycle">
      {steps.map((step) => (
        <div key={step.label} className={`appointment-lifecycle-row ${step.state}`}>
          <span className="workbench-check-dot" />
          <strong>{step.label}</strong>
          <em>{step.meta || (step.state === "pending" ? "Pending" : "Complete")}</em>
        </div>
      ))}
    </div>
  );
}

function DoctorNotesCompact({ chart, contextType, onNoteSaved }) {
  const [notes, setNotes] = useStatePC(asArray(chart?.notes));
  const [draft, setDraft] = useStatePC("");
  const [composing, setComposing] = useStatePC(false);
  const [saving, setSaving] = useStatePC(false);
  const [error, setError] = useStatePC("");

  useEffectPC(() => {
    setNotes(asArray(chart?.notes));
    setDraft("");
    setComposing(false);
    setError("");
  }, [chart?.patient?.id, chart?.notes]);

  const save = async () => {
    const noteText = draft.trim();
    if (noteText.length < 2) {
      setError("Write a note before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = await createDoctorNote(chart.patient.id, {
        note_text: noteText,
        context_type: contextType || "SCHEDULE",
      });
      const nextNotes = [data.note, ...notes];
      setNotes(nextNotes);
      setDraft("");
      setComposing(false);
      onNoteSaved?.(data.note);
    } catch {
      setError("Could not save doctor note.");
    } finally {
      setSaving(false);
    }
  };

  const latestNote = notes[0];

  return (
    <div className="appointment-clinical-block">
      <div className="appointment-clinical-head">
        <div>
          <span>Doctor notes</span>
          <strong>{latestNote ? "Latest note" : "No notes yet"}</strong>
        </div>
        <button type="button" className="btn-ghost" onClick={() => setComposing((value) => !value)}>
          {composing ? "Cancel" : "Add note"}
        </button>
      </div>
      {latestNote ? (
        <article className="appointment-note-preview">
          <div>
            <strong>{latestNote.actor?.display_name || "Clinical team"}</strong>
            <span>{formatDateTime(latestNote.created_at)}</span>
          </div>
          <p>{latestNote.note_text}</p>
        </article>
      ) : null}
      {composing ? (
        <div className="appointment-note-composer">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add internal clinical context..." maxLength={4000} rows={3} />
          <div>
            <span>{draft.trim().length ? `${draft.trim().length}/4000` : "Internal only"}</span>
            <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving" : "Save note"}</button>
          </div>
        </div>
      ) : null}
      {error ? <div className="doctor-note-error">{error}</div> : null}
    </div>
  );
}

function AppointmentClinicalCard({
  chart,
  lifecycle,
  latestPrescription,
  deliveries,
  patientPayload,
  onAmendPrescription,
  onNoteSaved,
}) {
  const latestDelivery = deliveries[0];
  const prescriptionItems = itemLabel(latestPrescription?.items);
  const deliveryItems = itemLabel(latestDelivery?.items);

  return (
    <section className="appointment-clinical-card">
      <CompactLifecycle steps={lifecycle} />

      <DoctorNotesCompact
        chart={chart}
        contextType="SCHEDULE"
        onNoteSaved={onNoteSaved}
      />

      {latestPrescription ? (
        <div className="appointment-clinical-block">
          <div className="appointment-clinical-head">
            <div>
              <span>Latest prescription</span>
              <strong>{prescriptionStatusLabel(latestPrescription)}</strong>
            </div>
            {latestPrescription.can_amend ? (
              <button type="button" className="btn-ghost" onClick={() => onAmendPrescription?.(patientPayload, latestPrescription)}>Re-issue</button>
            ) : null}
          </div>
          <div className="appointment-summary-row">
            <strong>{prescriptionItems || latestPrescription.title || "Prescription"}</strong>
            <span>{[formatMoneyFils(latestPrescription.amount_fils), formatDateTime(latestPrescription.issued_at)].filter(Boolean).join(" · ") || "Details unavailable"}</span>
          </div>
        </div>
      ) : null}

      {latestDelivery ? (
        <div className="appointment-clinical-block">
          <div className="appointment-clinical-head">
            <div>
              <span>Medication order</span>
              <strong>{medicationStatusLabel(latestDelivery)}</strong>
            </div>
          </div>
          <div className="appointment-summary-row">
            <strong>{deliveryItems || "Medication order"}</strong>
            <span>{[formatMoneyFils(latestDelivery.amount_fils), formatDate(latestDelivery.delivered_at || latestDelivery.paid_at)].filter(Boolean).join(" · ") || "No delivery date"}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TaskClinicalCard({
  chart,
  lifecycle,
  latestPrescription,
  deliveries,
  patientPayload,
  onAmendPrescription,
  onNoteSaved,
}) {
  const latestDelivery = deliveries[0];
  const prescriptionItems = itemLabel(latestPrescription?.items);
  const deliveryItems = itemLabel(latestDelivery?.items);

  return (
    <section className="task-clinical-card">
      <CompactLifecycle steps={lifecycle} />

      {latestPrescription ? (
        <div className="appointment-clinical-block">
          <div className="appointment-clinical-head">
            <div>
              <span>Latest prescription</span>
              <strong>{prescriptionStatusLabel(latestPrescription)}</strong>
            </div>
            {latestPrescription.can_amend ? (
              <button type="button" className="btn-ghost" onClick={() => onAmendPrescription?.(patientPayload, latestPrescription)}>Re-issue</button>
            ) : null}
          </div>
          <div className="appointment-summary-row">
            <strong>{prescriptionItems || latestPrescription.title || "Prescription"}</strong>
            <span>{[formatMoneyFils(latestPrescription.amount_fils), formatDateTime(latestPrescription.issued_at)].filter(Boolean).join(" · ") || "Details unavailable"}</span>
          </div>
        </div>
      ) : null}

      {latestDelivery ? (
        <div className="appointment-clinical-block">
          <div className="appointment-clinical-head">
            <div>
              <span>Medication order</span>
              <strong>{medicationStatusLabel(latestDelivery)}</strong>
            </div>
          </div>
          <div className="appointment-summary-row">
            <strong>{deliveryItems || "Medication order"}</strong>
            <span>{[formatMoneyFils(latestDelivery.amount_fils), formatDate(latestDelivery.delivered_at || latestDelivery.paid_at)].filter(Boolean).join(" · ") || "No delivery date"}</span>
          </div>
        </div>
      ) : null}

      <DoctorNotesCompact
        chart={chart}
        contextType="CLINICAL_INBOX"
        onNoteSaved={onNoteSaved}
      />
    </section>
  );
}

function ChatClinicalCard({
  chart,
  lifecycle,
  patient,
  medication,
  latestPrescription,
  deliveries,
  onOpenPatient,
  onNoteSaved,
}) {
  const { Avatar } = window.DD_UI;
  const latestDelivery = deliveries[0];
  const prescriptionItems = itemLabel(latestPrescription?.items);
  const deliveryItems = itemLabel(latestDelivery?.items);

  return (
    <section className="chat-clinical-card">
      <div className="chat-clinical-head">
        <div className="patient-emr-identity">
          <Avatar initials={patient.initials || "P"} name={patient.name || "Patient"} size="lg" />
          <div>
            <h2>{patient.name || "Patient"}</h2>
            <div className="meta">
              {[patient.phone, patient.age ? `${patient.age} years` : null, titleCase(patient.sex)].filter(Boolean).map((item, index) => (
                <React.Fragment key={`${item}-${index}`}>
                  {index > 0 && <span className="dot-sep" />}
                  <span>{item}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        {onOpenPatient ? (
          <button type="button" className="btn-ghost" onClick={() => onOpenPatient(patient.id, patient.customer_id)}>Open chart</button>
        ) : null}
      </div>

      <div className="chat-clinical-facts">
        <ChartFact label="Current medication" value={medication?.name || "Not listed"} />
        <ChartFact label="Last prescription" value={latestPrescription ? formatDate(latestPrescription.issued_at) : "None"} />
      </div>

      <CompactLifecycle steps={lifecycle} />

      {latestPrescription ? (
        <div className="appointment-clinical-block">
          <div className="appointment-clinical-head">
            <div>
              <span>Latest prescription</span>
              <strong>{prescriptionStatusLabel(latestPrescription)}</strong>
            </div>
          </div>
          <div className="appointment-summary-row">
            <strong>{prescriptionItems || latestPrescription.title || "Prescription"}</strong>
            <span>{[formatMoneyFils(latestPrescription.amount_fils), formatDateTime(latestPrescription.issued_at)].filter(Boolean).join(" · ") || "Details unavailable"}</span>
          </div>
        </div>
      ) : null}

      {latestDelivery ? (
        <div className="appointment-clinical-block">
          <div className="appointment-clinical-head">
            <div>
              <span>Medication order</span>
              <strong>{medicationStatusLabel(latestDelivery)}</strong>
            </div>
          </div>
          <div className="appointment-summary-row">
            <strong>{deliveryItems || "Medication order"}</strong>
            <span>{[formatMoneyFils(latestDelivery.amount_fils), formatDate(latestDelivery.delivered_at || latestDelivery.paid_at)].filter(Boolean).join(" · ") || "No delivery date"}</span>
          </div>
        </div>
      ) : null}

      <DoctorNotesCompact
        chart={chart}
        contextType="CHAT"
        onNoteSaved={onNoteSaved}
      />
    </section>
  );
}

function ClinicalProfileModal({ chart, onClose, onSaved }) {
  const clinical = chart?.clinical || {};
  const demographics = clinical.demographics || {};
  const [draft, setDraft] = useStatePC({
    height_cm: demographics.height_cm ?? "",
    current_weight_kg: demographics.weight_kg ?? "",
    allergies_text: asArray(clinical.allergies).join("\n"),
    conditions_text: asArray(clinical.conditions).join("\n"),
    regular_medications_text: asArray(clinical.current_medications).map((item) => item.name).join("\n"),
  });
  const [saving, setSaving] = useStatePC(false);
  const [error, setError] = useStatePC("");

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await updateClinicalProfile(chart.patient.id, {
        height_cm: numberOrNull(draft.height_cm),
        current_weight_kg: numberOrNull(draft.current_weight_kg),
        allergies_json: { types: multilineToList(draft.allergies_text) },
        medical_conditions_json: { selected: multilineToList(draft.conditions_text) },
        regular_medications_text: String(draft.regular_medications_text || "").trim() || null,
      });
      onSaved?.(result.patient_file);
      onClose();
    } catch (err) {
      setError(err.message || "Could not update clinical profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="quickwlp-dialog-backdrop clinical-profile-dialog-backdrop">
      <div className="quickwlp-dialog clinical-profile-dialog" role="dialog" aria-modal="true">
        <div className="quickwlp-dialog-head">
          <div>
            <div className="quickwlp-dialog-title">Update clinical profile</div>
            <p>Update doctor-editable facts only. Prescriptions, delivery, visits, and refills stay system generated.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Close</button>
        </div>
        <div className="clinical-profile-form">
          <label><span>Height</span><input value={draft.height_cm} onChange={(event) => setDraft((current) => ({ ...current, height_cm: event.target.value }))} placeholder="cm" /></label>
          <label><span>Weight</span><input value={draft.current_weight_kg} onChange={(event) => setDraft((current) => ({ ...current, current_weight_kg: event.target.value }))} placeholder="kg" /></label>
          <label><span>Allergies</span><textarea value={draft.allergies_text} onChange={(event) => setDraft((current) => ({ ...current, allergies_text: event.target.value }))} placeholder="One per line" /></label>
          <label><span>Conditions</span><textarea value={draft.conditions_text} onChange={(event) => setDraft((current) => ({ ...current, conditions_text: event.target.value }))} placeholder="One per line" /></label>
          <label className="clinical-profile-form-wide"><span>Current meds</span><textarea value={draft.regular_medications_text} onChange={(event) => setDraft((current) => ({ ...current, regular_medications_text: event.target.value }))} placeholder="Non-DarDoc medications or supplements" /></label>
        </div>
        {error ? <div className="quickwlp-dialog-error">{error}</div> : null}
        <div className="quickwlp-dialog-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving" : "Save profile"}</button>
        </div>
      </div>
    </div>
  );
}

function DoctorNotes({ chart, contextType, onNoteSaved }) {
  const [notes, setNotes] = useStatePC(asArray(chart?.notes));
  const [draft, setDraft] = useStatePC("");
  const [saving, setSaving] = useStatePC(false);
  const [error, setError] = useStatePC("");

  useEffectPC(() => {
    setNotes(asArray(chart?.notes));
    setDraft("");
  }, [chart?.patient?.id, chart?.notes]);

  const save = async () => {
    const noteText = draft.trim();
    if (noteText.length < 2) {
      setError("Write a note before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = await createDoctorNote(chart.patient.id, {
        note_text: noteText,
        context_type: contextType || "PATIENT_CHART",
      });
      const nextNotes = [data.note, ...notes];
      setNotes(nextNotes);
      setDraft("");
      onNoteSaved?.(data.note);
    } catch {
      setError("Could not save doctor note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ChartSection title="Doctor notes" subtitle="Internal clinical handover and follow-up context." className="doctor-notes-section">
      <div className="doctor-note-composer">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a concise internal note..." maxLength={4000} rows={3} />
        <div className="doctor-note-composer-foot">
          <span>{draft.trim().length ? `${draft.trim().length}/4000` : "Internal only"}</span>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving" : "Save note"}</button>
        </div>
      </div>
      {error ? <div className="doctor-note-error">{error}</div> : null}
      {notes.length ? (
        <div className="doctor-note-list">
          {notes.slice(0, 8).map((note) => (
            <article className="doctor-note-card" key={note.note_id}>
              <div className="doctor-note-meta">
                <strong>{note.actor?.display_name || "Clinical team"}</strong>
                <span>{actorRoleLabel(note.actor?.actor_type)} · {formatDateTime(note.created_at)}</span>
              </div>
              <p>{note.note_text}</p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyInline>No doctor notes yet.</EmptyInline>
      )}
    </ChartSection>
  );
}

function Timeline({ events }) {
  const list = asArray(events).slice(0, 12);
  if (!list.length) return <EmptyInline>No clinical timeline yet.</EmptyInline>;
  return (
    <div className="patient-care-timeline">
      {list.map((event, index) => (
        <div className="patient-care-event" key={`${event.type}-${event.occurred_at}-${index}`}>
          <div className="patient-care-event-type">{titleCase(event.type)}</div>
          <div className="patient-care-event-body">
            <strong>{event.title || titleCase(event.type)}</strong>
            {event.description ? <span>{event.description}</span> : null}
          </div>
          <time>{formatDate(event.occurred_at)}</time>
        </div>
      ))}
    </div>
  );
}

function PatientChart({
  patientId,
  initialChart,
  mode = "full",
  focus = "overview",
  context,
  onMessage,
  onPrescribe,
  onAmendPrescription,
  onOpenPatient,
  onChartLoaded,
}) {
  const { I, Avatar } = window.DD_UI;
  const [chart, setChart] = useStatePC(initialChart || null);
  const [loading, setLoading] = useStatePC(Boolean(patientId) && !initialChart);
  const [error, setError] = useStatePC("");
  const [editingProfile, setEditingProfile] = useStatePC(false);
  const compact = mode === "compact";
  const appointmentMode = mode === "appointment";
  const taskMode = mode === "task";
  const focusedMode = compact || appointmentMode || taskMode;

  useEffectPC(() => {
    setChart(initialChart || null);
  }, [initialChart?.patient?.id]);

  useEffectPC(() => {
    if (!patientId) return undefined;
    if (initialChart?.patient?.id === patientId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchPatientChart(patientId)
      .then((data) => {
        if (cancelled) return;
        setChart(data);
        onChartLoaded?.(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load patient chart.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [patientId, initialChart?.patient?.id]);

  const lifecycle = useMemoPC(() => buildLifecycle(chart, context), [chart, context]);
  const patient = chart?.patient || {};
  const clinical = chart?.clinical || {};
  const demographics = clinical.demographics || {};
  const prescriptions = asArray(chart?.prescriptions);
  const deliveries = asArray(chart?.medication_delivery);
  const refills = asArray(chart?.refills);
  const consultations = asArray(chart?.consultations);
  const latestPrescription = prescriptions[0];
  const amendablePrescription = prescriptions.find((prescription) => prescription.can_amend === true);
  const nextAction = asArray(chart?.next_actions)[0];
  const medication = clinical.current_medications?.[0];
  const patientPayload = chartPatientActionPayload(chart);
  const trackKey = context?.prescribable?.trackKey || context?.prescribable?.track_key || latestPrescription?.track_key || primaryTrack(chart);

  if (!patientId && !chart) return <div className="empty-state">Select a patient chart.</div>;
  if (loading && !chart) return <div className="empty-state">Loading patient chart...</div>;
  if (error && !chart) return <div className="api-state patient-api-state">{error}</div>;
  if (!chart) return <div className="empty-state">Patient chart unavailable.</div>;

  const prescriptionAction = prescriptionActionForChart({ chart, context, medication, amendablePrescription });

  if (appointmentMode) {
    return (
      <div className={`patient-chart-unified patient-chart-${mode} focus-${focus}`}>
        <AppointmentClinicalCard
          chart={chart}
          lifecycle={lifecycle}
          latestPrescription={latestPrescription}
          deliveries={deliveries}
          patientPayload={patientPayload}
          onAmendPrescription={onAmendPrescription}
          onNoteSaved={(note) => setChart((current) => ({ ...current, notes: [note, ...asArray(current?.notes)] }))}
        />
      </div>
    );
  }

  if (taskMode) {
    return (
      <div className={`patient-chart-unified patient-chart-${mode} focus-${focus}`}>
        <TaskClinicalCard
          chart={chart}
          lifecycle={lifecycle}
          latestPrescription={latestPrescription}
          deliveries={deliveries}
          patientPayload={patientPayload}
          onAmendPrescription={onAmendPrescription}
          onNoteSaved={(note) => setChart((current) => ({ ...current, notes: [note, ...asArray(current?.notes)] }))}
        />
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`patient-chart-unified patient-chart-${mode} focus-${focus}`}>
        <ChatClinicalCard
          chart={chart}
          lifecycle={lifecycle}
          patient={patient}
          medication={medication}
          latestPrescription={latestPrescription}
          deliveries={deliveries}
          onOpenPatient={onOpenPatient}
          onNoteSaved={(note) => setChart((current) => ({ ...current, notes: [note, ...asArray(current?.notes)] }))}
        />
      </div>
    );
  }

  return (
    <>
      <div className={`patient-chart-unified patient-chart-${mode} focus-${focus}`}>
        {!appointmentMode && (
        <div className="patient-emr-head">
          <div className="patient-emr-identity">
            <Avatar initials={patient.initials || "P"} name={patient.name || "Patient"} size={compact ? "lg" : "xl"} />
            <div>
              <h2>{patient.name || "Patient"}</h2>
              <div className="meta">
                {[patient.phone, patient.email, patient.age ? `${patient.age} years` : null, titleCase(patient.sex), context?.label].filter(Boolean).map((item, index) => (
                  <React.Fragment key={`${item}-${index}`}>
                    {index > 0 && <span className="dot-sep" />}
                    <span>{item}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          {!compact && (
            <div className="patient-emr-actions">
              {onMessage ? <button className="btn-ghost" onClick={() => onMessage(patient.id, patient.customer_id)}>{I.message}<span>Message</span></button> : null}
              {onOpenPatient && mode !== "full" ? <button className="btn-ghost" onClick={() => onOpenPatient(patient.id, patient.customer_id)}>Open full chart</button> : null}
              {prescriptionAction?.mode === "reissue" ? (
                <button className="btn-primary" onClick={() => onAmendPrescription?.(patientPayload, prescriptionAction.prescription)}>{I.pill}<span>{prescriptionAction.label}</span></button>
              ) : onPrescribe && prescriptionAction ? (
                <button className="btn-primary" onClick={() => onPrescribe({ patientId: patient.id, customerId: patient.customer_id, trackKey, mode: prescriptionAction.mode, chart })}>{I.pill}<span>{prescriptionAction.label}</span></button>
              ) : null}
            </div>
          )}
        </div>
        )}

        {!focusedMode && (
          <CareStatePanel
            chart={chart}
            context={context}
            nextAction={nextAction}
            medication={medication}
            latestPrescription={latestPrescription}
            latestDelivery={deliveries[0]}
          />
        )}

        {!appointmentMode && context?.appointment ? (
          <ChartSection title="Appointment context" subtitle="Selected visit in relation to the full patient chart.">
            <div className="patient-profile-facts patient-chart-context-grid">
              <ChartFact label="Slot" value={`${context.appointment.time || ""}${context.appointment.duration ? ` · ${context.appointment.duration} min` : ""}`} />
              <ChartFact label="Service" value={context.appointment.service || context.appointment.service_name} />
              <ChartFact label="Status" value={titleCase(context.appointment.status)} />
              <ChartFact label="Source" value={context.appointment.source === "quickwlp" ? "Quick WLP" : "Lifestyle Rx"} />
            </div>
          </ChartSection>
        ) : null}

        {context?.task ? (
          <ChartSection title="Inbox context" subtitle="Why this patient is currently in the clinical queue.">
            <div className="patient-profile-facts patient-chart-context-grid">
              <ChartFact label="Task" value={context.task.summary || context.task.title} />
              <ChartFact label="Queue" value={titleCase(context.task.category)} />
              <ChartFact label="When" value={formatDateTime(context.task.occurredAt)} />
              <ChartFact label="Source" value={titleCase(context.task.source)} />
            </div>
          </ChartSection>
        ) : null}

        <ChartSection title="Prescription lifecycle" subtitle={focusedMode ? "" : "Consult, prescription, payment, delivery, and refill state in one place."} className="patient-lifecycle-section">
          <RxLifecycleStrip steps={lifecycle} />
        </ChartSection>

        <div className={compact || appointmentMode || taskMode ? "patient-chart-single" : "patient-emr-grid"}>
          <div className="patient-emr-main">
            <DoctorNotes chart={chart} contextType={compact ? "CHAT" : appointmentMode ? "SCHEDULE" : taskMode ? "CLINICAL_INBOX" : "PATIENT_HUB"} onNoteSaved={(note) => setChart((current) => ({ ...current, notes: [note, ...asArray(current?.notes)] }))} />

            <ChartSection title={focusedMode ? "Treatment and prescribing" : "Prescriptions"} subtitle={focusedMode ? "" : "Issued, unpaid, re-issued, and historical prescriptions."}>
              {focusedMode && clinical.current_medications?.length ? (
                  <div className="patient-medication-list">
                    {clinical.current_medications.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="patient-medication-row">
                        <div>
                          <strong>{item.name}</strong>
                          {item.schedule ? <p>{item.schedule}</p> : null}
                        </div>
                        {item.since ? <span>Since {formatDate(item.since)}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : focusedMode ? <EmptyInline>No active Rx medications.</EmptyInline> : null}

              {prescriptions.length ? (
                <div className={focusedMode ? "patient-care-subsection" : ""}>
                  {focusedMode ? <h4>Latest prescription</h4> : null}
                  <div className="patient-medication-list">
                    {prescriptions.slice(0, focusedMode ? 1 : 6).map((prescription) => (
                      <div key={prescription.id} className="patient-medication-row">
                        <div>
                          <strong>{itemLabel(prescription.items) || prescription.title || "Prescription"}</strong>
                          <p>{[prescriptionStatusLabel(prescription), formatMoneyFils(prescription.amount_fils)].filter(Boolean).join(" · ")}</p>
                        </div>
                        {prescription.can_amend ? <button type="button" onClick={() => onAmendPrescription?.(patientPayload, prescription)}>Re-issue</button> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : !focusedMode ? <EmptyInline>No prescription history found.</EmptyInline> : null}
            </ChartSection>

            <ChartSection title={focusedMode ? "Medication and delivery" : "Medication orders"} subtitle={focusedMode ? "" : "Paid medication orders and delivery outcomes."}>
              {deliveries.length ? (
                <div className="patient-delivery-history">
                  {deliveries.slice(0, focusedMode ? 1 : 6).map((delivery) => (
                    <div className="patient-delivery-row" key={delivery.order_id}>
                      <div><strong>{itemLabel(delivery.items) || "Medication order"}</strong><span>{delivery.order_id}</span></div>
                      <div><strong>{medicationStatusLabel(delivery)}</strong><span>{formatMoneyFils(delivery.amount_fils)}</span></div>
                      <div><strong>{formatDate(delivery.delivered_at || delivery.paid_at) || "Not available"}</strong><span>{delivery.delivered_at ? "Delivered" : "Paid"}</span></div>
                    </div>
                  ))}
                </div>
              ) : <EmptyInline>No delivered medication found.</EmptyInline>}
            </ChartSection>

            {!focusedMode && (
              <>
                <AssessmentReader assessment={clinical.assessment} />

                <ChartSection title="Patient timeline" subtitle="Consultations, prescriptions, deliveries, refills, assessments, and notes in one chronological chain.">
                  <Timeline events={chart.timeline} />
                </ChartSection>
              </>
            )}
          </div>

          {!compact && !appointmentMode && !taskMode ? (
            <aside className="patient-emr-rail">
              <PrescriptionGuardrails
                clinical={clinical}
                medication={medication}
                latestPrescription={latestPrescription}
                latestDelivery={deliveries[0]}
              />

              <ChartSection title="Clinical profile" subtitle="Vitals, safety flags, and current patient facts." action={<button type="button" onClick={() => setEditingProfile(true)}>Update</button>} className="patient-chart-overview">
                <div className="patient-profile-facts">
                  <ChartFact label="Track" value={trackLabel(trackKey)} />
                  <ChartFact label="Current medication" value={medication?.name || "Not listed"} />
                  <ChartFact label="Height / weight" value={[demographics.height_cm ? `${demographics.height_cm} cm` : null, demographics.weight_kg ? `${demographics.weight_kg} kg` : null].filter(Boolean).join(" · ") || "Not provided"} />
                  <ChartFact label="BMI" value={demographics.bmi || "Not provided"} />
                  <ChartFact label="Allergies" value={clinical.allergies?.length ? clinical.allergies.join(", ") : "None reported"} />
                  <ChartFact label="Conditions" value={clinical.conditions?.length ? clinical.conditions.join(", ") : "None reported"} />
                  <ChartFact label="Address" value={patient.address || "Not provided"} />
                </div>
              </ChartSection>
            </aside>
          ) : null}
        </div>
      </div>

      {editingProfile ? (
        <ClinicalProfileModal
          chart={chart}
          onClose={() => setEditingProfile(false)}
          onSaved={() => fetchPatientChart(chart.patient.id).then((data) => {
            setChart(data);
            onChartLoaded?.(data);
          }).catch(() => undefined)}
        />
      ) : null}
    </>
  );
}

window.DD_PatientChart = PatientChart;
