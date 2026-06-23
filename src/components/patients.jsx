import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { fetchJson } from "../lib/authFetch.js";

/* global React */
const { useEffect: useEffectP, useMemo: useMemoP, useState: useStateP } = React;

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
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Dubai",
  }).format(new Date(value));
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

function formatAppointmentDate(date, time) {
  if (!date) return time || "";
  const [year, month, day] = date.split("-").map(Number);
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Dubai",
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return time ? `${formatted} at ${time}` : formatted;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
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

function medicationName(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.name || item.title || "Medication";
}

function updateClinicalProfile(patientId, body) {
  return fetchJson(`${API_BASE}/doctor/patients/${encodeURIComponent(patientId)}/clinical-profile?doctor_id=${DOCTOR_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function firstUsefulAnswer(answers) {
  if (!answers) return null;
  const entries = Object.entries(answers).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value != null && value !== "";
  });
  const [key, value] = entries[0] || [];
  if (!key) return null;
  return {
    label: titleCase(key),
    value: Array.isArray(value) ? value.join(", ") : String(value),
  };
}

const INTERNAL_ASSESSMENT_KEYS = new Set([
  "legacy_source",
  "legacy_assessment_json",
  "template_version",
  "source",
]);

function answerLabel(key) {
  const normalized = String(key || "").trim();
  const known = {
    bmi: "BMI",
    age_years: "Age",
    height_cm: "Height",
    weight_kg: "Weight",
    is_pregnant: "Pregnant",
    is_breastfeeding: "Breastfeeding",
    preferred_medication: "Preferred medication",
    tried_weight_loss_programs_before: "Tried weight loss before",
  };
  return known[normalized] || titleCase(normalized);
}

function answerValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const values = value.map(answerValue).filter(Boolean);
    return values.join(", ");
  }
  return "";
}

function answerSectionForKey(key) {
  const normalized = String(key || "").toLowerCase();
  if (/(height|weight|bmi|age|gender)/.test(normalized)) return "Vitals";
  if (/(pregnant|pregnancy|breastfeeding|allerg|condition|medical|background)/.test(normalized)) return "Safety";
  if (/(preferred|medication|goal|tried|program|protocol|peptide|weight_loss)/.test(normalized)) return "Goals";
  return "Other";
}

function flattenAssessmentAnswers(value, parentKey = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  return Object.entries(value).flatMap(([key, rawValue]) => {
    if (INTERNAL_ASSESSMENT_KEYS.has(key)) return [];

    const nextKey = parentKey ? `${parentKey}.${key}` : key;
    if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      return flattenAssessmentAnswers(rawValue, nextKey);
    }

    const valueText = answerValue(rawValue);
    if (!valueText) return [];

    return [{
      key: nextKey,
      label: answerLabel(key),
      section: answerSectionForKey(nextKey),
      value: valueText,
    }];
  });
}

function groupedAssessmentAnswers(answers) {
  const rows = flattenAssessmentAnswers(answers);
  const order = ["Vitals", "Safety", "Goals", "Other"];
  return order
    .map((section) => ({
      section,
      rows: rows.filter((row) => row.section === section),
    }))
    .filter((group) => group.rows.length > 0);
}

function mapPrescriptionHistoryItem(item) {
  return {
    id: item.prescription_id,
    checkoutUrl: item.checkout_url || "",
    checkoutExpiresAt: item.checkout_expires_at || "",
    itemLabel: item.item_label || "Prescription checkout",
    status: item.status || "ACTIVE",
    createdAt: item.created_at || "",
  };
}

function mapPrescribablePatient(item) {
  return {
    id: item.patient_id,
    customerId: item.customer_id,
    trackKey: item.track_key || "",
    canPrescribe: item.can_prescribe === true,
    latestCompletedAt: item.latest_completed_at || "",
  };
}

function mapPatient(item) {
  const demographics = item.demographics || {};
  const basic = item.assessment?.basic || {};
  return {
    id: item.id,
    customerId: item.customer_id,
    name: item.name || "Unknown patient",
    initials: item.initials || "P",
    age: item.age,
    sex: titleCase(item.sex || basic.gender),
    phone: item.phone,
    email: item.email,
    address: item.address,
    city: item.city || item.emirate || "",
    emirate: item.emirate || "",
    demographics: {
      heightCm: demographics.height_cm ?? basic.height_cm,
      weightKg: demographics.weight_kg ?? basic.weight_kg,
      bmi: demographics.bmi ?? basic.bmi,
    },
    assessment: {
      basic,
      submissions: asArray(item.assessment?.submissions),
    },
    allergies: asArray(item.allergies),
    conditions: asArray(item.conditions),
    medications: asArray(item.medications),
    latestLabs: asArray(item.latest_labs),
    visitHistory: asArray(item.visit_history),
    prescriptionHistory: asArray(item.prescription_history).map(mapPrescriptionHistoryItem),
    upcoming: item.upcoming_appointment || null,
    chat: item.chat || { available: false, unavailable_reason: "chat_locked" },
    prescribe: null,
    prescribeChecked: false,
  };
}

function PatientsView({ initialPatientId, initialCustomerId, onMessage, onPrescribe }) {
  const { I, Avatar, Topbar } = window.DD_UI;
  const [patients, setPatients] = useStateP([]);
  const [search, setSearch] = useStateP("");
  const [filter, setFilter] = useStateP("all");
  const [selectedId, setSelectedId] = useStateP(initialPatientId || null);
  const [loading, setLoading] = useStateP(true);
  const [error, setError] = useStateP("");
  const today = useMemoP(() => dubaiToday(), []);

  const loadPatients = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, prescribableData] = await Promise.all([
        fetchJson(`${API_BASE}/doctor/dashboard/patients?doctor_id=${DOCTOR_ID}`),
        fetchJson(`${API_BASE}/doctor/rx/prescribable-patients?doctor_id=${DOCTOR_ID}&limit=100&offset=0`).catch(() => ({ patients: [] })),
      ]);
      const prescribablePatients = (prescribableData.patients || []).map(mapPrescribablePatient);
      const prescribableByPatient = new Map();
      const prescribableByCustomer = new Map();
      for (const item of prescribablePatients) {
        if (item.canPrescribe && item.id && !prescribableByPatient.has(item.id)) prescribableByPatient.set(item.id, item);
        if (item.canPrescribe && item.customerId && !prescribableByCustomer.has(item.customerId)) prescribableByCustomer.set(item.customerId, item);
      }
      const nextPatients = (data.patients || []).map((item) => {
        const patient = mapPatient(item);
        return {
          ...patient,
          prescribe: prescribableByPatient.get(patient.id) || prescribableByCustomer.get(patient.customerId) || null,
        };
      });
      setPatients(nextPatients);
      setSelectedId((current) => {
        if (initialPatientId && nextPatients.some((patient) => patient.id === initialPatientId)) return initialPatientId;
        if (initialCustomerId) {
          const patientByCustomer = nextPatients.find((patient) => patient.customerId === initialCustomerId);
          if (patientByCustomer) return patientByCustomer.id;
        }
        if (current && nextPatients.some((patient) => patient.id === current)) return current;
        return nextPatients[0]?.id || null;
      });
    } catch {
      setError("Could not load patients from the dev API.");
    } finally {
      setLoading(false);
    }
  }, [initialCustomerId, initialPatientId]);

  useEffectP(() => {
    const selected = patients.find((patient) => patient.id === selectedId);
    if (!selected || selected.prescribe || selected.prescribeChecked) return undefined;

    let cancelled = false;
    const loadSelectedPrescribeContext = async () => {
      const params = new URLSearchParams({
        doctor_id: DOCTOR_ID,
        patient_id: selected.id,
        limit: "10",
        offset: "0",
      });
      if (selected.customerId) params.set("customer_id", selected.customerId);

      try {
        const data = await fetchJson(`${API_BASE}/doctor/rx/prescribable-patients?${params.toString()}`);
        const prescribe = (data.patients || []).map(mapPrescribablePatient).find((item) => item.canPrescribe) || null;
        if (!cancelled) {
          setPatients((current) => current.map((patient) => (
            patient.id === selected.id ? { ...patient, prescribe, prescribeChecked: true } : patient
          )));
        }
      } catch {
        if (!cancelled) {
          setPatients((current) => current.map((patient) => (
            patient.id === selected.id ? { ...patient, prescribeChecked: true } : patient
          )));
        }
      }
    };

    loadSelectedPrescribeContext();
    return () => { cancelled = true; };
  }, [patients, selectedId]);

  useEffectP(() => {
    loadPatients();
  }, [loadPatients]);

  useEffectP(() => {
    if (initialPatientId) setSelectedId(initialPatientId);
    else if (initialCustomerId) {
      const patientByCustomer = patients.find((patient) => patient.customerId === initialCustomerId);
      if (patientByCustomer) setSelectedId(patientByCustomer.id);
    }
  }, [initialCustomerId, initialPatientId, patients]);

  const patientsToday = patients.filter((patient) => patient.upcoming?.date === today).length;
  const watchlistCount = patients.filter((patient) => patient.conditions.length || patient.allergies.length || patient.medications.length).length;
  const filtered = patients.filter((patient) => {
    const query = search.trim().toLowerCase();
    if (query) {
      const haystack = [patient.name, patient.phone, patient.email, patient.city].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filter === "today" && patient.upcoming?.date !== today) return false;
    if (filter === "watch" && !patient.conditions.length && !patient.allergies.length && !patient.medications.length) return false;
    return true;
  });
  const p = patients.find((patient) => patient.id === selectedId) || filtered[0] || null;

  return (
    <>
      <Topbar
        title="Patients"
        subtitle={loading ? "Loading Rx patients" : `${patients.length} active · ${patientsToday} with appointments today`}
        search={search}
        onSearch={setSearch}
        right={<button className="icon-btn">{I.filter}</button>}
      />
      <div className="patient-layout">
        <div className="patient-list dd-scroll">
          <div className="filter">
            <span className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>All <b>{patients.length}</b></span>
            <span className={"chip" + (filter === "today" ? " on" : "")} onClick={() => setFilter("today")}>Today <b>{patientsToday}</b></span>
            <span className={"chip" + (filter === "watch" ? " on" : "")} onClick={() => setFilter("watch")}>Watchlist <b>{watchlistCount}</b></span>
          </div>
          {error && (
            <div className="api-state patient-api-state">
              <span>{error}</span>
              <button type="button" className="btn-ghost" onClick={loadPatients}>Retry</button>
            </div>
          )}
          {loading ? (
            <div className="patient-loading">
              <div /><div /><div /><div />
            </div>
          ) : filtered.map((pat) => {
            const primaryMedication = pat.medications[0]?.name || "";
            const statusLabel = pat.upcoming
              ? "Visit booked"
              : pat.prescribe
                ? "Ready"
                : primaryMedication
                  ? "Active Rx"
                  : "Chart";

            return (
              <button type="button" key={pat.id} className={"p-row" + (pat.id === p?.id ? " active" : "")} onClick={() => setSelectedId(pat.id)}>
                <Avatar initials={pat.initials} name={pat.name} size="md" />
                <div className="p-row-main">
                  <div className="pn">{pat.name}</div>
                  <div className="pm">{[pat.phone, pat.city, pat.age ? `${pat.age}y` : null, pat.sex].filter(Boolean).join(" · ") || "Rx patient"}</div>
                  <div className="pt">{primaryMedication || pat.upcoming?.service_name || "No active treatment listed"}</div>
                </div>
                <span className={"p-state" + (pat.prescribe ? " ready" : "")}>{statusLabel}</span>
              </button>
            );
          })}
          {!loading && filtered.length === 0 && <div style={{ padding: 24, color: "var(--dd-text-tertiary)", font: "400 13px/1.5 var(--dd-font)" }}>No patients found.</div>}
        </div>

        <div className="patient-pane dd-scroll fade-in" key={p?.id || "empty"}>
          {loading ? <div className="empty-state">Loading patient profile...</div> : p ? <PatientDetail p={p} onMessage={onMessage} onPrescribe={onPrescribe} onProfileSaved={loadPatients} /> : <div className="empty-state">Select a patient</div>}
        </div>
      </div>
    </>
  );
}

function EmptyInline({ children }) {
  return <div className="inline-empty">{children}</div>;
}

function PatientPrescriptionHistory({ prescriptions }) {
  const list = Array.isArray(prescriptions) ? prescriptions : [];
  if (!list.length) return null;

  return (
    <div className="patient-prescription-history">
      {list.map((prescription) => {
        const status = String(prescription.status || "ACTIVE").toLowerCase();
        return (
          <div key={prescription.id} className="patient-prescription-row">
            <div>
              <div className="patient-prescription-title">{prescription.itemLabel}</div>
              <div className="patient-prescription-meta">
                {[prescription.checkoutExpiresAt ? `Expires ${formatDateTime(prescription.checkoutExpiresAt)}` : "", prescription.createdAt ? `Created ${formatDateTime(prescription.createdAt)}` : ""].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="patient-prescription-actions">
              <span className={`quickwlp-prescription-status ${status}`}>{titleCase(prescription.status)}</span>
              {prescription.checkoutUrl && (
                <a className="quickwlp-prescription-open" href={prescription.checkoutUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssessmentHistoryRow({ submission, expanded, onToggle }) {
  const groupedAnswers = groupedAssessmentAnswers(submission.answers);
  const hasAnswers = groupedAnswers.length > 0;
  const title = titleCase(submission.track_key || submission.kind);

  return (
    <div className={"rx-submission-row assessment-row" + (expanded ? " expanded" : "")}>
      <button type="button" className="assessment-row-trigger" onClick={onToggle}>
        <span>
          <span className="t">{title}</span>
          <span className="s">Version {submission.template_version} · {formatDate(submission.submitted_at)}</span>
        </span>
        <span className="assessment-row-action">{hasAnswers ? (expanded ? "Hide answers" : "View answers") : "No answers"}</span>
      </button>

      {expanded && hasAnswers ? (
        <div className="assessment-answer-panel">
          {groupedAnswers.map((group) => (
            <div className="assessment-answer-group" key={group.section}>
              <div className="assessment-answer-section">{group.section}</div>
              {group.rows.map((row) => (
                <div className="assessment-answer-row" key={row.key}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ClinicalProfileModal({ patient, onClose, onSaved }) {
  const [draft, setDraft] = useStateP({
    height_cm: patient?.demographics?.heightCm ?? "",
    current_weight_kg: patient?.demographics?.weightKg ?? "",
    allergies_text: asArray(patient?.allergies).join("\n"),
    conditions_text: asArray(patient?.conditions).join("\n"),
    regular_medications_text: patient?.assessment?.basic?.regular_medications || asArray(patient?.medications).map(medicationName).join("\n"),
  });
  const [saving, setSaving] = useStateP(false);
  const [error, setError] = useStateP("");

  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  const save = async () => {
    if (!patient?.id) return;
    setSaving(true);
    setError("");
    try {
      await updateClinicalProfile(patient.id, {
        height_cm: numberOrNull(draft.height_cm),
        current_weight_kg: numberOrNull(draft.current_weight_kg),
        allergies_json: { types: multilineToList(draft.allergies_text) },
        medical_conditions_json: { selected: multilineToList(draft.conditions_text) },
        regular_medications_text: String(draft.regular_medications_text || "").trim() || null,
      });
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || "Could not update clinical profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="quickwlp-dialog-backdrop clinical-profile-dialog-backdrop">
      <div className="quickwlp-dialog clinical-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="patient-clinical-profile-title">
        <div className="quickwlp-dialog-head">
          <div>
            <div id="patient-clinical-profile-title" className="quickwlp-dialog-title">Update clinical profile</div>
            <p>Update doctor-editable facts only. Prescription, delivery, visit, and refill history stay system generated.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Close</button>
        </div>

        <div className="clinical-profile-form">
          <label>
            <span>Height</span>
            <input inputMode="decimal" value={draft.height_cm} onChange={(event) => setField("height_cm", event.target.value)} placeholder="cm" />
          </label>
          <label>
            <span>Weight</span>
            <input inputMode="decimal" value={draft.current_weight_kg} onChange={(event) => setField("current_weight_kg", event.target.value)} placeholder="kg" />
          </label>
          <label>
            <span>Allergies</span>
            <textarea value={draft.allergies_text} onChange={(event) => setField("allergies_text", event.target.value)} placeholder="One per line" />
          </label>
          <label>
            <span>Conditions</span>
            <textarea value={draft.conditions_text} onChange={(event) => setField("conditions_text", event.target.value)} placeholder="One per line" />
          </label>
          <label className="clinical-profile-form-wide">
            <span>Current meds</span>
            <textarea value={draft.regular_medications_text} onChange={(event) => setField("regular_medications_text", event.target.value)} placeholder="Non-DarDoc medications or supplements" />
          </label>
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

function PatientDetail({ p, onMessage, onPrescribe, onProfileSaved }) {
  const { I, Avatar } = window.DD_UI;
  const [editingProfile, setEditingProfile] = useStateP(false);
  const [expandedAssessmentId, setExpandedAssessmentId] = useStateP("");
  const latestSubmission = p.assessment.submissions[0];
  const latestAnswer = firstUsefulAnswer(latestSubmission?.answers);
  const basics = p.assessment.basic || {};
  const clinicalFlags = [
    ...p.allergies.map((item) => ({ label: item, tone: "warn", icon: I.warn })),
    ...p.conditions.map((item) => ({ label: item, tone: "", icon: null })),
  ];
  const demographics = [
    { label: "Age", value: p.age ? `${p.age} years` : "" },
    { label: "Sex", value: p.sex },
    { label: "City", value: p.city },
    {
      label: "Height / weight",
      value: [p.demographics.heightCm ? `${p.demographics.heightCm} cm` : null, p.demographics.weightKg ? `${p.demographics.weightKg} kg` : null].filter(Boolean).join(" · "),
    },
    { label: "BMI", value: p.demographics.bmi },
  ].filter((item) => item.value);
  const hasAssessmentSummary = Boolean(basics.activity_level || basics.body_shape || basics.pregnancy_status || basics.breastfeeding_status || latestSubmission);
  const hasHistory = Boolean(p.prescriptionHistory.length || p.visitHistory.length || p.assessment.submissions.length);

  useEffectP(() => {
    setExpandedAssessmentId(p.assessment.submissions[0]?.id || "");
  }, [p.id, p.assessment.submissions]);

  return (
    <>
      <div className="patient-hero">
        <Avatar initials={p.initials} name={p.name} size="xl" />
        <div>
          <h2>{p.name}</h2>
          <div className="meta">
            {[p.age ? `${p.age} years` : null, p.sex, p.city, p.demographics.bmi ? `BMI ${p.demographics.bmi}` : null].filter(Boolean).map((item, index) => (
              <React.Fragment key={item}>
                {index > 0 && <span className="dot-sep" />}
                <span>{item}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="actions">
          <button
            className="btn-ghost"
            onClick={() => onMessage(p.id)}
            disabled={!p.chat?.available}
            title={p.chat?.available ? "Message patient" : "Chat is locked for this patient"}
            style={{ opacity: p.chat?.available ? 1 : 0.45, cursor: p.chat?.available ? "pointer" : "not-allowed" }}
          >
            {I.message}<span>Message</span>
          </button>
          <button
            className="btn-primary"
            onClick={() => p.prescribe && onPrescribe(p.id, p.customerId, p.prescribe.trackKey)}
            disabled={!p.prescribe}
            title={p.prescribe ? "Prescribe for this patient" : "Complete a consultation before prescribing"}
            style={{ opacity: p.prescribe ? 1 : 0.45, cursor: p.prescribe ? "pointer" : "not-allowed" }}
          >
            {I.pill}<span>{p.prescribe ? "Prescribe" : "Consult first"}</span>
          </button>
        </div>
      </div>

      {p.upcoming && (
        <div className="dd-card-tan" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, padding: "14px 18px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {I.calendar}
            <div>
              <div style={{ font: "400 14px/1.2 var(--dd-font)" }}>Next: {p.upcoming.service_name}</div>
              <div style={{ font: "400 12px/1.4 var(--dd-font)", color: "var(--dd-text-secondary)", marginTop: 2 }}>{formatAppointmentDate(p.upcoming.date, p.upcoming.time)}</div>
            </div>
          </div>
          <button className="btn-ghost" style={{ padding: "8px 14px" }}>View</button>
        </div>
      )}

      <div className="patient-chart">
        <section className="patient-chart-section patient-chart-overview">
          <div className="patient-chart-section-head">
            <div>
              <h3>Patient snapshot</h3>
              <p>Contact, demographics, and clinical flags.</p>
            </div>
            <button type="button" onClick={() => setEditingProfile(true)}>Update clinical profile</button>
          </div>

          <div className="patient-snapshot-grid">
            <div className="patient-snapshot-card">
              <span>Phone</span>
              <strong>{p.phone || "Not provided"}</strong>
            </div>
            <div className="patient-snapshot-card">
              <span>Email</span>
              <strong>{p.email || "Not provided"}</strong>
            </div>
            {demographics.map((item) => (
              <div className="patient-snapshot-card" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="patient-clinical-flags">
            {clinicalFlags.length ? clinicalFlags.map((flag, index) => (
              <span key={`${flag.label}-${index}`} className={"patient-flag " + flag.tone}>
                {flag.icon}<span>{flag.label}</span>
              </span>
            )) : (
              <span className="patient-flag clear">No allergies or active conditions recorded</span>
            )}
          </div>
        </section>

        <section className="patient-chart-section">
          <div className="patient-chart-section-head">
            <div>
              <h3>Current treatment</h3>
              <p>Medication the doctor should account for before prescribing again.</p>
            </div>
          </div>

          {p.medications.length ? (
            <div className="patient-medication-list">
              {p.medications.map((m, i) => (
                <div key={i} className="patient-medication-row">
                  <div>
                    <strong>{m.name}</strong>
                    {m.schedule && <p>{m.schedule}</p>}
                  </div>
                  {m.since && <span>Since {formatDate(m.since)}</span>}
                </div>
              ))}
            </div>
          ) : (
            <EmptyInline>No active Rx medications.</EmptyInline>
          )}
        </section>

        {hasAssessmentSummary && (
          <section className="patient-chart-section">
            <div className="patient-chart-section-head">
              <div>
                <h3>Assessment summary</h3>
                <p>Latest structured intake details.</p>
              </div>
            </div>
            <div className="assessment-grid">
              {basics.activity_level && <div><span>Activity</span><strong>{basics.activity_level}</strong></div>}
              {basics.body_shape && <div><span>Body shape</span><strong>{basics.body_shape}</strong></div>}
              {basics.pregnancy_status && <div><span>Pregnancy</span><strong>{basics.pregnancy_status}</strong></div>}
              {basics.breastfeeding_status && <div><span>Breastfeeding</span><strong>{basics.breastfeeding_status}</strong></div>}
            </div>
            {latestSubmission && (
              <div className="assessment-latest">
                <div className="kind">{titleCase(latestSubmission.track_key || latestSubmission.kind)} · {formatDate(latestSubmission.submitted_at)}</div>
                {latestAnswer && <div className="answer"><span>{latestAnswer.label}</span><strong>{latestAnswer.value}</strong></div>}
              </div>
            )}
          </section>
        )}

        {hasHistory && (
          <section className="patient-chart-section">
            <div className="patient-chart-section-head">
              <div>
                <h3>History</h3>
                <p>Consults, prescriptions, and submitted assessments.</p>
              </div>
            </div>
            <div className="patient-history-grid">
              <div>
                <h4>Visits</h4>
                {p.visitHistory.length ? (
                  <div className="timeline-mini">
                    {p.visitHistory.map((h) => (
                      <div key={h.id} className="tm-row">
                        <div className="d">{formatDate(h.date)}</div>
                        <div className="b">
                          <div className="t">{h.title}</div>
                          {h.note && <div className="s">{h.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <EmptyInline>No visit history yet.</EmptyInline>}
              </div>

              <div>
                <h4>Prescriptions</h4>
                {p.prescriptionHistory.length ? <PatientPrescriptionHistory prescriptions={p.prescriptionHistory} /> : <EmptyInline>No checkout history yet.</EmptyInline>}

                {p.assessment.submissions.length ? (
                  <>
                    <h4 className="patient-history-subhead">Assessments</h4>
                    {p.assessment.submissions.map((submission) => (
                      <AssessmentHistoryRow
                        key={submission.id}
                        submission={submission}
                        expanded={expandedAssessmentId === submission.id}
                        onToggle={() => setExpandedAssessmentId((current) => (current === submission.id ? "" : submission.id))}
                      />
                    ))}
                  </>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {p.address && (
          <section className="patient-chart-section patient-chart-muted">
            <div className="patient-chart-section-head">
              <div>
                <h3>Address</h3>
                <p>{p.address}</p>
              </div>
            </div>
          </section>
        )}
      </div>

      {editingProfile ? (
        <ClinicalProfileModal
          patient={p}
          onClose={() => setEditingProfile(false)}
          onSaved={onProfileSaved}
        />
      ) : null}
    </>
  );
}

window.DD_PatientsView = PatientsView;
