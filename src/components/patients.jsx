import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";

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
      const response = await fetch(`${API_BASE}/doctor/dashboard/patients?doctor_id=${DOCTOR_ID}`);
      if (!response.ok) throw new Error(`patients_request_failed_${response.status}`);
      const data = await response.json();
      const nextPatients = (data.patients || []).map(mapPatient);
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
  const filtered = patients.filter((patient) => {
    const query = search.trim().toLowerCase();
    if (query) {
      const haystack = [patient.name, patient.phone, patient.email].filter(Boolean).join(" ").toLowerCase();
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
            <span className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>All</span>
            <span className={"chip" + (filter === "today" ? " on" : "")} onClick={() => setFilter("today")}>Today</span>
            <span className={"chip" + (filter === "watch" ? " on" : "")} onClick={() => setFilter("watch")}>Watchlist</span>
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
          ) : filtered.map((pat) => (
            <div key={pat.id} className={"p-row" + (pat.id === p?.id ? " active" : "")} onClick={() => setSelectedId(pat.id)}>
              <Avatar initials={pat.initials} name={pat.name} size="md" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="pn">{pat.name}</div>
                <div className="pm">{[pat.age ? `${pat.age}` : null, pat.sex, pat.upcoming ? pat.upcoming.service_name : null].filter(Boolean).join(" · ") || "Rx patient"}</div>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 && <div style={{ padding: 24, color: "var(--dd-text-tertiary)", font: "400 13px/1.5 var(--dd-font)" }}>No patients found.</div>}
        </div>

        <div className="patient-pane dd-scroll fade-in" key={p?.id || "empty"}>
          {loading ? <div className="empty-state">Loading patient profile...</div> : p ? <PatientDetail p={p} onMessage={onMessage} onPrescribe={onPrescribe} /> : <div className="empty-state">Select a patient</div>}
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
  if (!list.length) return <EmptyInline>No prescription checkout history yet.</EmptyInline>;

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

function PatientDetail({ p, onMessage, onPrescribe }) {
  const { I, Avatar } = window.DD_UI;
  const latestSubmission = p.assessment.submissions[0];
  const latestAnswer = firstUsefulAnswer(latestSubmission?.answers);
  const basics = p.assessment.basic || {};

  return (
    <>
      <div className="patient-hero">
        <Avatar initials={p.initials} name={p.name} size="xl" />
        <div>
          <h2>{p.name}</h2>
          <div className="meta">
            {[p.age ? `${p.age} years` : null, p.sex, p.demographics.bmi ? `BMI ${p.demographics.bmi}` : null].filter(Boolean).map((item, index) => (
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
          <button className="btn-primary" onClick={() => onPrescribe(p.id)}>{I.pill}<span>Prescribe</span></button>
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

      <div className="detail-grid">
        <div>
          <div className="detail-block">
            <h3>Allergies & active conditions</h3>
            <div style={{ marginBottom: 8 }}>
              {p.allergies.length ? p.allergies.map((a, i) => <span key={i} className="tag warn">{I.warn}<span style={{ marginLeft: 6 }}>{a}</span></span>) : <EmptyInline>No allergies reported.</EmptyInline>}
            </div>
            <div>
              {p.conditions.length ? p.conditions.map((c, i) => <span key={i} className="tag">{c}</span>) : <EmptyInline>No active conditions reported.</EmptyInline>}
            </div>
          </div>

          <div className="detail-block">
            <h3>Current Rx medications</h3>
            {p.medications.length ? p.medications.map((m, i) => (
              <div key={i} className="kv-row">
                <div>
                  <div style={{ font: "400 15px/1.3 var(--dd-font)", color: "var(--dd-text-primary)" }}>{m.name}</div>
                  {m.schedule && <div style={{ font: "400 12px/1.4 var(--dd-font)", color: "var(--dd-text-secondary)", marginTop: 3 }}>{m.schedule}</div>}
                </div>
                {m.since && <div className="v">Since {formatDate(m.since)}</div>}
              </div>
            )) : <EmptyInline>No active Rx medications.</EmptyInline>}
          </div>

          <div className="detail-block">
            <h3>Prescription history</h3>
            <PatientPrescriptionHistory prescriptions={p.prescriptionHistory} />
          </div>

          <div className="detail-block">
            <h3>Assessment summary</h3>
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
            {!basics.activity_level && !latestSubmission && <EmptyInline>No assessment summary available.</EmptyInline>}
          </div>

          <div className="detail-block">
            <h3>Visit history</h3>
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
        </div>

        <div>
          <div className="detail-block">
            <h3>Demographics & contact</h3>
            <div className="kv-row"><div className="k">Phone</div><div className="v">{p.phone || "Not provided"}</div></div>
            <div className="kv-row"><div className="k">Email</div><div className="v">{p.email || "Not provided"}</div></div>
            <div className="kv-row"><div className="k">Address</div><div className="v">{p.address || "Not provided"}</div></div>
            <div className="kv-row"><div className="k">Height / Weight</div><div className="v">{[p.demographics.heightCm ? `${p.demographics.heightCm} cm` : null, p.demographics.weightKg ? `${p.demographics.weightKg} kg` : null].filter(Boolean).join(" · ") || "Not provided"}</div></div>
            <div className="kv-row"><div className="k">BMI</div><div className="v">{p.demographics.bmi || "Not provided"}</div></div>
          </div>

          <div className="detail-block">
            <h3>Assessment submissions</h3>
            {p.assessment.submissions.length ? p.assessment.submissions.map((submission) => (
              <div key={submission.id} className="rx-submission-row">
                <div className="t">{titleCase(submission.track_key || submission.kind)}</div>
                <div className="s">Version {submission.template_version} · {formatDate(submission.submitted_at)}</div>
              </div>
            )) : <EmptyInline>No submitted assessments.</EmptyInline>}
          </div>

          <div className="detail-block">
            <h3>Lab results</h3>
            {p.latestLabs.length ? (
              <div className="lab-grid">
                {p.latestLabs.map((l, i) => (
                  <div key={i} className={"lab " + (l.status || "normal")}>
                    <div className="ln">{l.name} · {l.status}</div>
                    <div className="lv">{l.value}<span className="lu">{l.unit && " " + l.unit}</span></div>
                    <div className="lr">{l.reference_range ? `Ref ${l.reference_range}` : formatDate(l.measured_at)}</div>
                  </div>
                ))}
              </div>
            ) : <EmptyInline>Lab summaries are not connected yet.</EmptyInline>}
          </div>
        </div>
      </div>
    </>
  );
}

window.DD_PatientsView = PatientsView;
