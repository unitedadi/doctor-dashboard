import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { fetchJson } from "../lib/authFetch.js";
import "./patientDemographics.css";

const displayBirthDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value.split("-").reverse().join("/") : value || "";
const labels = { name: "name", date_of_birth: "date of birth", gender: "gender" };
function errorText(error) {
  const code = error.payload?.error || error.message;
  return {
    readonly_preview: "This preview uses live patient data in read-only mode. Changes have not been saved.",
    invalid_patient_date_of_birth: "Enter a valid date of birth that is not in the future.",
    validation_error: "Enter the patient’s full name, date of birth, and gender.",
    patient_not_found: "The linked member could not be found. Ask Ops to verify the consultation’s member.",
    patient_identity_ambiguous: "More than one member is linked. Ask Ops to verify the intended patient.",
    patient_identity_conflict: "The member’s identity needs verification by Ops before editing.",
    patient_demographics_sync_failed: "The member details were saved, but the chart did not finish syncing. Retry Save details to complete the update.",
    doctor_portal_actor_doctor_mismatch: "You do not have access to edit this patient.",
  }[code] || "Could not load or save patient details. Please try again.";
}

export default function PatientDemographics({ patientId, leadId, doctorId = DOCTOR_ID, onSaved, onReady }) {
  const [patient, setPatient] = React.useState(null);
  const [draft, setDraft] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState(false);
  const [reload, setReload] = React.useState(0);
  const path = leadId ? `/doctor/quickwlp/requests/${encodeURIComponent(leadId)}/demographics`
    : `/doctor/patients/${encodeURIComponent(patientId)}/demographics`;

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true); setPatient(null); setDraft(null); setError(""); setSaved(false); onReady?.(false);
    fetchJson(`${API_BASE}${path}?doctor_id=${encodeURIComponent(doctorId)}`)
      .then(data => { if (!cancelled) { setPatient(data.patient); onReady?.(!data.patient.missing_fields?.length); } })
      .catch(err => { if (!cancelled) setError(errorText(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, doctorId, reload, onReady]);

  const edit = () => { setError(""); setSaved(false); setDraft({ name: patient.name || "", date_of_birth: displayBirthDate(patient.date_of_birth), gender: ["male", "female", "other"].includes(patient.gender?.toLowerCase()) ? patient.gender.toLowerCase() : "" }); };
  const save = async event => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const data = await fetchJson(`${API_BASE}/doctor/patients/${encodeURIComponent(patient.patient_id)}/demographics?doctor_id=${encodeURIComponent(doctorId)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      setPatient(data.patient); setDraft(null); setSaved(true); onReady?.(!data.patient.missing_fields?.length); onSaved?.(data.patient);
    } catch (err) { setError(errorText(err)); } finally { setSaving(false); }
  };
  const missing = patient?.missing_fields || [];
  return <section className={`patient-demographics${missing.length ? " needs-details" : ""}`} aria-label="Patient details">
    <div className="patient-demographics-heading"><div><strong>{missing.length ? "Complete patient details before prescribing" : "Patient details"}</strong>
      <p>{loading ? "Checking the linked patient’s details…" : patient ? missing.length ? `Missing: ${missing.map(field => labels[field] || field).join(", ")}. Clinical profile updates do not change these details.` : `${patient.name} · ${displayBirthDate(patient.date_of_birth) || "Date of birth not recorded"} · ${patient.gender}` : "Patient details could not be checked."}</p>
    </div>{patient && !draft && <button className="btn-ghost" type="button" onClick={edit}>{missing.length ? "Complete details" : "Edit details"}</button>}</div>
    {error && <div role="alert" className="patient-demographics-error">{error}{!draft && <button type="button" className="btn-ghost" onClick={() => setReload(value => value + 1)}>Try again</button>}</div>}
    {saved && <p role="status">Patient details saved. You can continue prescribing.</p>}
    {draft && <form onSubmit={save}>
      <p>Confirm these details with the patient. Saving updates this member’s record and records your edit.</p>
      <div className="patient-demographics-fields">
        <label>Full name<input required maxLength={160} value={draft.name} disabled={saving} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Date of birth<input required type="text" placeholder="DD/MM/YYYY" pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" value={draft.date_of_birth} disabled={saving} onChange={event => setDraft({ ...draft, date_of_birth: event.target.value })} /></label>
        <label>Gender<select required value={draft.gender} disabled={saving} onChange={event => setDraft({ ...draft, gender: event.target.value })}><option value="">Select gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
      </div>
      <div className="patient-demographics-actions"><button className="btn-ghost" type="button" disabled={saving} onClick={() => { setDraft(null); setError(""); }}>Cancel</button><button className="btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save details"}</button></div>
    </form>}
  </section>;
}
