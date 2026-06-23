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

function positiveNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function firstPresent(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

function calculateBmi(heightCm, weightKg) {
  const height = positiveNumber(heightCm);
  const weight = positiveNumber(weightKg);
  if (!height || !weight) return null;
  const bmi = weight / ((height / 100) ** 2);
  return Number.isFinite(bmi) ? Number(bmi.toFixed(1)) : null;
}

function assessmentDisplayValue(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[a-z0-9]+([_-][a-z0-9]+)+$/i.test(trimmed)) return titleCase(trimmed);
  if (/^[a-z0-9 ]+$/.test(trimmed) && trimmed === trimmed.toLowerCase()) return titleCase(trimmed);
  return trimmed;
}

function medicationName(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.name || item.title || "Medication";
}

function formatMoneyFils(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return `AED ${(amount / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function updateClinicalProfile(patientId, body) {
  return fetchJson(`${API_BASE}/doctor/patients/${encodeURIComponent(patientId)}/clinical-profile?doctor_id=${DOCTOR_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fetchDoctorNotes(patientId) {
  return fetchJson(`${API_BASE}/doctor/patients/${encodeURIComponent(patientId)}/chart?doctor_id=${DOCTOR_ID}`)
    .then((chart) => ({ notes: asArray(chart.notes) }));
}

function createDoctorNote(patientId, body) {
  return fetchJson(`${API_BASE}/doctor/patients/${encodeURIComponent(patientId)}/notes?doctor_id=${DOCTOR_ID}`, {
    method: "POST",
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
    value: Array.isArray(value)
      ? value.map(assessmentDisplayValue).filter(Boolean).join(", ")
      : String(assessmentDisplayValue(value)),
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
  if (typeof value === "string") return assessmentDisplayValue(value);
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
  const items = asArray(item.items || item.items_json).map((line) => ({
    product_id: line.product_id || line.productId || "",
    name: line.name || line.product_name || "Medication",
    quantity: Number(line.quantity || 1),
    doctor_instructions: line.doctor_instructions || line.doctorInstructions || "",
    price_fils: line.price_fils || 0,
  }));
  const itemLabel = item.item_label
    || item.title
    || (items.length ? items.map((line) => `${line.name}${line.quantity > 1 ? ` x${line.quantity}` : ""}`).join(", ") : "Prescription checkout");
  return {
    id: item.id || item.prescription_id,
    source: item.source || (item.checkout_url ? "quickwlp_prescription" : "rx_care_plan"),
    trackKey: item.track_key || "weight-loss",
    quickWlpLeadId: item.lead_id || item.quickwlp_lead_id || "",
    checkoutUrl: item.checkout_url || "",
    checkoutExpiresAt: item.checkout_expires_at || "",
    itemLabel,
    status: item.status || "ACTIVE",
    canAmend: item.can_amend === true || item.canAmend === true,
    createdAt: item.created_at || "",
    issuedAt: item.issued_at || "",
    items,
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

function findAmendablePrescription(prescriptions) {
  return asArray(prescriptions).find((item) => item.canAmend === true) || null;
}

function hasActiveRxPrescription(prescriptions) {
  return asArray(prescriptions).some((item) => (
    item.source === "rx_care_plan" && String(item.status || "").toUpperCase() === "ACTIVE"
  ));
}

function isIssuedUnpaidPrescription(prescription) {
  return prescription?.source === "rx_care_plan" && String(prescription?.status || "").toUpperCase() === "PUBLISHED";
}

function isUnpaidEditablePrescription(prescription) {
  return isIssuedUnpaidPrescription(prescription) || prescription?.canAmend === true;
}

function prescriptionMedicationLabel(prescription) {
  return asArray(prescription?.items)
    .map((item) => `${item.name || "Medication"}${item.quantity > 1 ? ` x${item.quantity}` : ""}`)
    .filter(Boolean)
    .join(", ");
}

function prescriptionStatusLabel(prescription) {
  if (isIssuedUnpaidPrescription(prescription)) return "Issued · payment pending";
  return titleCase(prescription?.status || "Issued");
}

function actorRoleLabel(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Clinical team";
  if (normalized === "SUPER_ADMIN") return "Super admin";
  if (normalized === "CLINICAL_ADMIN") return "Clinical admin";
  return titleCase(normalized);
}

function orderItemsLabel(items) {
  return asArray(items)
    .map((item) => `${item.name || "Medication"}${Number(item.quantity || 1) > 1 ? ` x${Number(item.quantity || 1)}` : ""}`)
    .filter(Boolean)
    .join(", ");
}

function refillStatusLabel(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "PENDING_REVIEW") return "Pending review";
  if (normalized === "PRESCRIBED") return "Prescribed";
  if (normalized === "DECLINED") return "Declined";
  return titleCase(value || "Refill");
}

function refillAdjustmentLabel(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "INCREASE_DOSE") return "Increase dose";
  if (normalized === "SAME_DOSE") return "Same dose";
  if (normalized === "DECREASE_DOSE") return "Decrease dose";
  if (normalized === "PAUSE") return "Pause";
  return titleCase(value || "");
}

function prescriptionActionCopy(patient) {
  if (findAmendablePrescription(patient.prescriptionHistory)) {
    return {
      label: "Re-issue prescription",
      title: "Update the unpaid prescription before payment",
      disabled: false,
      mode: "amend",
    };
  }
  if (hasActiveRxPrescription(patient.prescriptionHistory)) {
    return {
      label: "Follow-up prescription",
      title: patient.prescribe ? "Create a follow-up prescription" : "A new completed consultation is required before issuing again",
      disabled: !patient.prescribe,
      mode: "prescribe",
    };
  }
  return {
    label: patient.prescribe ? "Issue prescription" : "Consult first",
    title: patient.prescribe ? "Issue prescription for this patient" : "Complete a consultation before issuing a prescription",
    disabled: !patient.prescribe,
    mode: "prescribe",
  };
}

function mapPatient(item) {
  const demographics = item.demographics || {};
  const basic = item.assessment?.basic || {};
  const heightCm = firstPresent(demographics.height_cm, basic.height_cm, basic.current_height_cm, basic.height);
  const weightKg = firstPresent(demographics.weight_kg, basic.weight_kg, basic.current_weight_kg, basic.weight);
  const bmi = firstPresent(demographics.bmi, basic.bmi, calculateBmi(heightCm, weightKg));
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
      heightCm,
      weightKg,
      bmi,
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
    deliveredMedications: asArray(item.delivered_medications),
    refillHistory: asArray(item.refill_history),
    prescriptionHistory: [
      ...asArray(item.rx_prescription_history),
      ...asArray(item.prescription_history),
    ].map(mapPrescriptionHistoryItem),
    upcoming: item.upcoming_appointment || null,
    chat: item.chat || { available: false, unavailable_reason: "chat_locked" },
    prescribe: null,
    prescribeChecked: false,
  };
}

function PatientsView({ initialPatientId, initialCustomerId, onMessage, onPrescribe, onAmendPrescription, embedded = false }) {
  const { I, Avatar, Topbar } = window.DD_UI;
  const PatientChart = window.DD_PatientChart;
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
  const filtered = patients.filter((patient) => {
    const query = search.trim().toLowerCase();
    if (query) {
      const haystack = [patient.name, patient.phone, patient.email, patient.city].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filter === "today" && patient.upcoming?.date !== today) return false;
    return true;
  });
  const p = patients.find((patient) => patient.id === selectedId) || filtered[0] || null;

  return (
    <>
      {!embedded && (
        <Topbar
          title="Patients"
          subtitle={loading ? "Loading Rx patients" : `${patients.length} active · ${patientsToday} with appointments today`}
          search={search}
          onSearch={setSearch}
          right={<button className="icon-btn">{I.filter}</button>}
        />
      )}
      {embedded && (
        <div className="patient-embedded-toolbar">
          <div>
            <strong>Patient charts</strong>
            <span>{loading ? "Loading charts" : `${patients.length} charts available`}</span>
          </div>
          <label>
            {I.search}
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search charts by name, phone, email, or city"
            />
          </label>
        </div>
      )}
      <div className="patient-layout">
        <div className="patient-list dd-scroll">
          <div className="filter">
            <span className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>All <b>{patients.length}</b></span>
            <span className={"chip" + (filter === "today" ? " on" : "")} onClick={() => setFilter("today")}>Today <b>{patientsToday}</b></span>
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
            const hasAmendable = Boolean(findAmendablePrescription(pat.prescriptionHistory));
            const hasActiveRx = hasActiveRxPrescription(pat.prescriptionHistory);
            const statusLabel = hasAmendable
              ? "Amend"
              : hasActiveRx
                ? "Follow-up"
                : pat.upcoming
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
          {loading ? (
            <div className="empty-state">Loading patient profile...</div>
          ) : p && PatientChart ? (
            <PatientChart
              patientId={p.id}
              mode="full"
              focus="patient-hub"
              context={{ prescribable: p.prescribe }}
              onMessage={(id) => onMessage?.(id)}
              onPrescribe={({ patientId, customerId, trackKey, mode }) => onPrescribe?.(patientId, customerId, trackKey, mode)}
              onAmendPrescription={onAmendPrescription}
            />
          ) : p ? (
            <PatientDetail p={p} onMessage={onMessage} onPrescribe={onPrescribe} onAmendPrescription={onAmendPrescription} onProfileSaved={loadPatients} />
          ) : (
            <div className="empty-state">Select a patient</div>
          )}
        </div>
      </div>
    </>
  );
}

function EmptyInline({ children }) {
  return <div className="inline-empty">{children}</div>;
}

function PatientPrescriptionHistory({ prescriptions, onAmend }) {
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
                {[prescriptionStatusLabel(prescription), prescriptionMedicationLabel(prescription), prescription.checkoutExpiresAt ? `Expires ${formatDateTime(prescription.checkoutExpiresAt)}` : "", (prescription.issuedAt || prescription.createdAt) ? `Issued ${formatDateTime(prescription.issuedAt || prescription.createdAt)}` : ""].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="patient-prescription-actions">
              <span className={`quickwlp-prescription-status ${status}`}>{isIssuedUnpaidPrescription(prescription) ? "Payment pending" : titleCase(prescription.status)}</span>
              {prescription.checkoutUrl && (
                <a className="quickwlp-prescription-open" href={prescription.checkoutUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              )}
              {prescription.canAmend && (
                <button type="button" className="quickwlp-prescription-open" onClick={() => onAmend?.(prescription)}>
                  Re-issue
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MedicationDeliveryHistory({ deliveries }) {
  const list = asArray(deliveries);
  if (!list.length) return <EmptyInline>No delivered medication history found.</EmptyInline>;

  return (
    <div className="patient-delivery-history">
      {list.map((delivery, index) => (
        <div className="patient-delivery-row" key={delivery.order_id || index}>
          <div>
            <strong>{orderItemsLabel(delivery.items) || "Medication order"}</strong>
            <span>{[delivery.order_id, formatMoneyFils(delivery.amount_fils)].filter(Boolean).join(" · ")}</span>
          </div>
          <div>
            <span>Paid</span>
            <strong>{delivery.paid_at ? formatDateTime(delivery.paid_at) : "Not available"}</strong>
          </div>
          <div>
            <span>Delivered</span>
            <strong>{delivery.delivered_at ? formatDateTime(delivery.delivered_at) : "Not available"}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function patientRefillLifecycle(refill, hasDeliveredMedication, canPrescribe) {
  const status = String(refill?.status || "").toUpperCase();
  if (status === "PENDING_REVIEW") {
    return { state: "current", meta: refill.submitted_at ? `Requested ${formatDateTime(refill.submitted_at)}` : "Needs review" };
  }
  if (status === "PRESCRIBED") {
    return { state: "done", meta: refill.reviewed_at ? `Prescribed ${formatDateTime(refill.reviewed_at)}` : "Prescribed" };
  }
  if (status === "DECLINED") {
    return { state: "risk", meta: refill.reviewed_at ? `Declined ${formatDateTime(refill.reviewed_at)}` : "Declined" };
  }
  if (canPrescribe && hasDeliveredMedication) return { state: "current", meta: "Follow-up can be issued" };
  if (hasDeliveredMedication) return { state: "pending", meta: "Monitor for next refill" };
  return { state: "pending", meta: "Not due yet" };
}

function patientLifecycleSteps(patient) {
  const visits = asArray(patient.visitHistory);
  const prescriptions = asArray(patient.prescriptionHistory);
  const deliveries = asArray(patient.deliveredMedications);
  const refills = asArray(patient.refillHistory);
  const latestVisit = visits[0];
  const latestPrescription = prescriptions[0];
  const latestUnpaid = prescriptions.find(isUnpaidEditablePrescription);
  const latestDelivery = deliveries[0];
  const latestRefill = refills[0];
  const hasScheduledConsult = Boolean(patient.upcoming || latestVisit);
  const hasCompletedConsult = Boolean(latestVisit);
  const hasPrescription = Boolean(latestPrescription);
  const hasUnpaidPrescription = Boolean(latestUnpaid);
  const paidAt = latestDelivery?.paid_at;
  const deliveredAt = latestDelivery?.delivered_at;
  const refillState = patientRefillLifecycle(latestRefill, Boolean(deliveredAt), Boolean(patient.prescribe));

  return [
    {
      label: "Consultation scheduled",
      meta: patient.upcoming ? formatAppointmentDate(patient.upcoming.date, patient.upcoming.time) : latestVisit ? formatDate(latestVisit.date) : "Not booked",
      state: hasScheduledConsult ? "done" : "pending",
    },
    {
      label: "Consultation completed",
      meta: latestVisit ? formatDate(latestVisit.date) : patient.upcoming ? "Awaiting consult" : "Not completed",
      state: hasCompletedConsult ? "done" : patient.upcoming ? "current" : "pending",
    },
    {
      label: hasPrescription ? "Prescription issued" : "Prescription not issued",
      meta: hasPrescription ? formatDateTime(latestPrescription.issuedAt || latestPrescription.createdAt) : hasCompletedConsult ? "Ready for doctor decision" : "Waiting for consultation",
      state: hasPrescription ? "done" : hasCompletedConsult ? "current" : "pending",
    },
    {
      label: "Issued but unpaid",
      meta: hasUnpaidPrescription ? prescriptionMedicationLabel(latestUnpaid) || latestUnpaid.itemLabel : paidAt ? "Payment received" : "No unpaid prescription",
      state: hasUnpaidPrescription ? "current" : paidAt ? "done" : "pending",
    },
    {
      label: "Paid",
      meta: paidAt ? formatDateTime(paidAt) : hasUnpaidPrescription ? "Awaiting payment" : "Not paid",
      state: paidAt ? "done" : hasUnpaidPrescription ? "current" : "pending",
    },
    {
      label: "Delivered",
      meta: deliveredAt ? formatDateTime(deliveredAt) : paidAt ? "Awaiting delivery" : "Not delivered",
      state: deliveredAt ? "done" : paidAt ? "current" : "pending",
    },
    {
      label: "Follow-up/refill due",
      meta: refillState.meta,
      state: refillState.state,
    },
  ];
}

function RxLifecycleStrip({ steps }) {
  return (
    <div className="rx-lifecycle-strip patient-lifecycle-strip">
      {steps.map((step) => (
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

function RefillHistory({ refills }) {
  const list = asArray(refills);
  if (!list.length) return <EmptyInline>No refill requests found.</EmptyInline>;

  return (
    <div className="patient-refill-history">
      {list.map((refill, index) => (
        <div className="patient-refill-row" key={refill.id || index}>
          <div>
            <strong>{refillStatusLabel(refill.status)}</strong>
            <span>{refill.submitted_at ? `Requested ${formatDateTime(refill.submitted_at)}` : "Request date not available"}</span>
          </div>
          <div>
            <span>Adjustment</span>
            <strong>{refillAdjustmentLabel(refill.dosage_adjustment) || "Not provided"}</strong>
          </div>
          <div>
            <span>Side effects</span>
            <strong>{titleCase(refill.side_effects || "Not provided")}</strong>
          </div>
          <div>
            <span>Reviewed</span>
            <strong>{refill.reviewed_at ? formatDateTime(refill.reviewed_at) : "Not reviewed"}</strong>
          </div>
        </div>
      ))}
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

function ChartTimeline({ visits, prescriptions, assessments, deliveries, refills }) {
  const events = [
    ...asArray(visits).map((visit) => ({
      id: `visit-${visit.id || visit.date || visit.title}`,
      type: "Visit",
      title: visit.title || "Consultation",
      detail: visit.note || "",
      occurredAt: visit.date,
    })),
    ...asArray(prescriptions).map((prescription) => ({
      id: `prescription-${prescription.id}`,
      type: "Prescription",
      title: prescriptionMedicationLabel(prescription) || prescription.itemLabel || "Prescription",
      detail: prescriptionStatusLabel(prescription),
      occurredAt: prescription.issuedAt || prescription.createdAt,
    })),
    ...asArray(assessments).map((submission) => ({
      id: `assessment-${submission.id}`,
      type: "Assessment",
      title: titleCase(submission.track_key || submission.kind),
      detail: `Version ${submission.template_version || 1}`,
      occurredAt: submission.submitted_at,
    })),
    ...asArray(deliveries).map((delivery) => ({
      id: `delivery-${delivery.order_id}`,
      type: "Delivery",
      title: orderItemsLabel(delivery.items) || "Medication delivered",
      detail: [delivery.order_id, formatMoneyFils(delivery.amount_fils)].filter(Boolean).join(" · "),
      occurredAt: delivery.delivered_at || delivery.paid_at,
    })),
    ...asArray(refills).map((refill) => ({
      id: `refill-${refill.id}`,
      type: "Refill",
      title: refillStatusLabel(refill.status),
      detail: [refillAdjustmentLabel(refill.dosage_adjustment), refill.side_effects ? `${titleCase(refill.side_effects)} side effects` : ""].filter(Boolean).join(" · "),
      occurredAt: refill.reviewed_at || refill.submitted_at,
    })),
  ].filter((event) => event.occurredAt)
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 10);

  if (!events.length) return <EmptyInline>No clinical history yet.</EmptyInline>;

  return (
    <div className="patient-care-timeline">
      {events.map((event) => (
        <div className="patient-care-event" key={event.id}>
          <div className="patient-care-event-type">{event.type}</div>
          <div className="patient-care-event-body">
            <strong>{event.title}</strong>
            {event.detail ? <span>{event.detail}</span> : null}
          </div>
          <time>{formatDate(event.occurredAt)}</time>
        </div>
      ))}
    </div>
  );
}

function DoctorNotesSection({ patientId }) {
  const [notes, setNotes] = useStateP([]);
  const [draft, setDraft] = useStateP("");
  const [loading, setLoading] = useStateP(true);
  const [saving, setSaving] = useStateP(false);
  const [error, setError] = useStateP("");

  const loadNotes = React.useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchDoctorNotes(patientId);
      setNotes(asArray(data.notes));
    } catch {
      setError("Could not load doctor notes.");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffectP(() => {
    setDraft("");
    loadNotes();
  }, [loadNotes]);

  const save = async () => {
    const noteText = draft.trim();
    if (noteText.length < 2) {
      setError("Write a note before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = await createDoctorNote(patientId, {
        note_text: noteText,
        context_type: "PATIENT_HUB",
      });
      setNotes((current) => [data.note, ...current]);
      setDraft("");
    } catch {
      setError("Could not save doctor note.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ChartSection
      title="Doctor notes"
      subtitle="Internal notes for clinical handover and follow-up context."
      className="doctor-notes-section"
    >
      <div className="doctor-note-composer">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a concise internal note for the next clinical decision..."
          maxLength={4000}
          rows={3}
        />
        <div className="doctor-note-composer-foot">
          <span>{draft.trim().length ? `${draft.trim().length}/4000` : "Internal only"}</span>
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving" : "Save note"}
          </button>
        </div>
      </div>

      {error ? <div className="doctor-note-error">{error}</div> : null}

      {loading ? (
        <EmptyInline>Loading doctor notes...</EmptyInline>
      ) : notes.length ? (
        <div className="doctor-note-list">
          {notes.map((note) => (
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

function PatientDetail({ p, onMessage, onPrescribe, onAmendPrescription, onProfileSaved }) {
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
  const primaryPrescriptionAction = prescriptionActionCopy(p);
  const issuedUnpaidPrescriptions = p.prescriptionHistory.filter(isIssuedUnpaidPrescription);
  const historicalPrescriptions = p.prescriptionHistory.filter((prescription) => !isIssuedUnpaidPrescription(prescription));
  const currentMedication = p.medications[0];
  const latestVisit = p.visitHistory[0];
  const latestPrescription = p.prescriptionHistory[0];
  const latestDelivery = p.deliveredMedications[0];
  const latestRefill = p.refillHistory[0];
  const lifecycleSteps = patientLifecycleSteps(p);
  const nextAppointment = p.upcoming ? `${p.upcoming.service_name} · ${formatAppointmentDate(p.upcoming.date, p.upcoming.time)}` : "";
  const primaryClinicalState = issuedUnpaidPrescriptions.length
    ? "Prescription issued, payment pending"
    : p.prescribe
      ? "Ready to issue"
      : currentMedication
        ? "Treatment active"
        : p.upcoming
          ? "Consultation booked"
          : "Chart open";
  const vitals = [
    p.demographics.heightCm ? `${p.demographics.heightCm} cm` : null,
    p.demographics.weightKg ? `${p.demographics.weightKg} kg` : null,
    p.demographics.bmi ? `BMI ${p.demographics.bmi}` : null,
  ].filter(Boolean).join(" · ");
  const latestIntakeFacts = [
    basics.activity_level ? { label: "Activity", value: assessmentDisplayValue(basics.activity_level) } : null,
    basics.body_shape ? { label: "Body shape", value: assessmentDisplayValue(basics.body_shape) } : null,
    basics.pregnancy_status ? { label: "Pregnancy", value: assessmentDisplayValue(basics.pregnancy_status) } : null,
    basics.breastfeeding_status ? { label: "Breastfeeding", value: assessmentDisplayValue(basics.breastfeeding_status) } : null,
    latestAnswer ? { label: latestAnswer.label, value: latestAnswer.value } : null,
  ].filter(Boolean).slice(0, 4);

  useEffectP(() => {
    setExpandedAssessmentId(p.assessment.submissions[0]?.id || "");
  }, [p.id, p.assessment.submissions]);

  return (
    <>
      <div className="patient-emr-shell">
        <div className="patient-emr-head">
          <div className="patient-emr-identity">
            <Avatar initials={p.initials} name={p.name} size="xl" />
            <div>
              <h2>{p.name}</h2>
              <div className="meta">
                {[p.phone, p.age ? `${p.age} years` : null, p.sex, p.city].filter(Boolean).map((item, index) => (
                  <React.Fragment key={item}>
                    {index > 0 && <span className="dot-sep" />}
                    <span>{item}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <div className="patient-emr-actions">
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
              onClick={() => {
                if (primaryPrescriptionAction.mode === "amend") {
                  const prescription = findAmendablePrescription(p.prescriptionHistory);
                  if (prescription) onAmendPrescription?.(p, prescription);
                  return;
                }
                if (p.prescribe) {
                  onPrescribe(
                    p.id,
                    p.customerId,
                    p.prescribe.trackKey,
                    primaryPrescriptionAction.label === "Follow-up prescription" ? "followup" : "issue"
                  );
                }
              }}
              disabled={primaryPrescriptionAction.disabled}
              title={primaryPrescriptionAction.title}
              style={{ opacity: primaryPrescriptionAction.disabled ? 0.45 : 1, cursor: primaryPrescriptionAction.disabled ? "not-allowed" : "pointer" }}
            >
              {I.pill}<span>{primaryPrescriptionAction.label}</span>
            </button>
          </div>
        </div>

        <div className="patient-emr-status">
          <ChartFact label="Clinical state" value={primaryClinicalState} />
          <ChartFact label="Current medication" value={currentMedication?.name || "Not listed"} />
          <ChartFact label="Next visit" value={nextAppointment || "Not booked"} />
          <ChartFact label="Last prescription" value={latestPrescription ? formatDate(latestPrescription.issuedAt || latestPrescription.createdAt) : "None"} />
          <ChartFact label="Last delivery" value={latestDelivery ? formatDate(latestDelivery.delivered_at || latestDelivery.paid_at) : "None"} />
        </div>

        <ChartSection
          title="Prescription lifecycle"
          subtitle="Consult, prescription, payment, delivery, and refill state in one place."
          className="patient-lifecycle-section"
        >
          <RxLifecycleStrip steps={lifecycleSteps} />
        </ChartSection>

        <div className="patient-emr-grid">
          <div className="patient-emr-main">
            <DoctorNotesSection patientId={p.id} />

            <ChartSection
              title="Treatment and prescribing"
              subtitle="Active medication and prescriptions that still need clinical attention."
            >
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

              {issuedUnpaidPrescriptions.length ? (
                <div className="patient-care-subsection">
                  <h4>Issued but unpaid</h4>
                  <PatientPrescriptionHistory
                    prescriptions={issuedUnpaidPrescriptions}
                    onAmend={(prescription) => onAmendPrescription?.(p, prescription)}
                  />
                </div>
              ) : null}
            </ChartSection>

            <ChartSection
              title="Medication and delivery"
              subtitle="Medication orders that reached the patient."
            >
              <MedicationDeliveryHistory deliveries={p.deliveredMedications} />
            </ChartSection>

            <ChartSection
              title="Refill and follow-up"
              subtitle="Refill requests, dose changes, side effects, and review outcomes."
            >
              <RefillHistory refills={p.refillHistory} />
            </ChartSection>

            <ChartSection
              title="Clinical timeline"
              subtitle="Consultations, prescriptions, deliveries, refills, and assessments in one chronological view."
            >
              <ChartTimeline
                visits={p.visitHistory}
                prescriptions={historicalPrescriptions}
                assessments={p.assessment.submissions}
                deliveries={p.deliveredMedications}
                refills={p.refillHistory}
              />
            </ChartSection>

            {p.assessment.submissions.length ? (
              <ChartSection
                title="Assessment answers"
                subtitle="Structured intake responses submitted by the patient."
              >
                {p.assessment.submissions.map((submission) => (
                  <AssessmentHistoryRow
                    key={submission.id}
                    submission={submission}
                    expanded={expandedAssessmentId === submission.id}
                    onToggle={() => setExpandedAssessmentId((current) => (current === submission.id ? "" : submission.id))}
                  />
                ))}
              </ChartSection>
            ) : null}
          </div>

          <aside className="patient-emr-rail">
            <ChartSection
              title="Clinical profile"
              subtitle="Vitals, safety flags, and current patient facts."
              action={<button type="button" onClick={() => setEditingProfile(true)}>Update</button>}
              className="patient-chart-overview"
            >
              <div className="patient-profile-facts">
                <ChartFact label="Vitals" value={vitals || "Not provided"} />
                <ChartFact label="Email" value={p.email || "Not provided"} />
                <ChartFact label="Address" value={p.address || "Not provided"} />
                {demographics.filter((item) => !["Age", "Sex", "City", "BMI", "Height / weight"].includes(item.label)).map((item) => (
                  <ChartFact key={item.label} label={item.label} value={item.value} />
                ))}
              </div>

              {latestIntakeFacts.length ? (
                <div className="patient-profile-intake">
                  <div className="patient-profile-intake-head">
                    <span>Latest intake</span>
                    {latestSubmission ? <strong>{titleCase(latestSubmission.track_key || latestSubmission.kind)} · {formatDate(latestSubmission.submitted_at)}</strong> : null}
                  </div>
                  <div className="patient-profile-intake-grid">
                    {latestIntakeFacts.map((item) => (
                      <div key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="patient-clinical-flags">
                {clinicalFlags.length ? clinicalFlags.map((flag, index) => (
                  <span key={`${flag.label}-${index}`} className={"patient-flag " + flag.tone}>
                    {flag.icon}<span>{flag.label}</span>
                  </span>
                )) : (
                  <span className="patient-flag clear">No allergies or active conditions recorded</span>
                )}
              </div>
            </ChartSection>

          <ChartSection title="Recall" subtitle="Fast context for the next clinical decision.">
              <div className="patient-profile-facts">
                <ChartFact label="Last visit" value={latestVisit ? `${latestVisit.title} · ${formatDate(latestVisit.date)}` : "No visit history"} />
                <ChartFact label="Last medication" value={currentMedication?.name || "Not listed"} />
                <ChartFact label="Last prescription" value={latestPrescription?.itemLabel || "No prescription history"} />
                <ChartFact label="Last refill" value={latestRefill ? `${refillStatusLabel(latestRefill.status)} · ${formatDate(latestRefill.reviewed_at || latestRefill.submitted_at)}` : "No refill history"} />
              </div>
            </ChartSection>
          </aside>
        </div>
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
