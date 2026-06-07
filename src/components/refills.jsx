import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";

/* global React */
const { useEffect: useEffectF, useMemo: useMemoF, useState: useStateF } = React;

const STATUS_FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "reviewed", label: "Reviewed" },
  { key: "all", label: "All" },
];

const ANSWER_LABELS = {
  dosage_adjustment: {
    STAY_CURRENT_DOSE: "No, stay on current dose",
    INCREASE_DOSE: "Yes, increase dose",
    LOWER_DOSE: "Yes, lower dose",
    DISCUSS_BY_PHONE: "Discuss by phone call",
  },
  delivery_experience: {
    EXTREMELY_SATISFIED: "Extremely satisfied",
    SATISFIED: "Satisfied",
    NEUTRAL: "Neutral",
    DISSATISFIED: "Dissatisfied",
  },
  weight_loss_last_month: {
    LESS_THAN_4KG: "Less than 4 kg",
    FOUR_TO_SEVEN_KG: "4 kg to 7 kg",
    EIGHT_TO_TWELVE_KG: "8 kg to 12 kg",
    MORE_THAN_TWELVE_KG: "More than 12 kg",
  },
  side_effects: {
    NONE: "None, feeling great",
    MILD: "Mild (occasional nausea/reflux)",
    MODERATE: "Moderate (constipation/fatigue)",
    SEVERE: "Severe (persistent vomiting/stomach pain)",
  },
};

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || data.error || `request_failed_${response.status}`);
    error.payload = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function patientInitials(name) {
  const parts = String(name || "Patient").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "P") + (parts[1]?.[0] || "");
}

function readAnswer(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return "";
}

function answerLabel(group, value) {
  if (value === null || value === undefined || value === "") return "";
  return ANSWER_LABELS[group]?.[value] || titleCase(value);
}

function formatWeight(value) {
  if (value === null || value === undefined || value === "") return "";
  return /kg\b/i.test(String(value)) ? String(value) : `${value} kg`;
}

function mapRefillRequest(item) {
  const patient = item.patient || item.member || {};
  const customer = item.customer || {};
  const questionnaire = item.questionnaire || item.answers || item.answers_json || item.form || item || {};
  const patientName = item.patient_name || patient.name || patient.full_name || "Unknown patient";
  const dosageAdjustment = readAnswer(questionnaire, ["dosage_adjustment", "dose_adjustment", "dosePreference", "dose_preference"]);
  const deliveryExperience = readAnswer(questionnaire, ["delivery_experience", "delivery_rating", "experience"]);
  const progress = readAnswer(questionnaire, ["weight_loss_last_month", "total_progress", "weight_loss_range", "progress"]);
  const currentWeight = readAnswer(questionnaire, ["current_weight_kg", "current_weight", "weight_kg"]);
  const sideEffects = readAnswer(questionnaire, ["side_effects", "sideEffects"]);
  return {
    id: item.refill_request_id || item.request_id || item.id,
    customerId: item.customer_id || patient.customer_id,
    patientId: item.patient_id || item.member_id || patient.id || patient.patient_id,
    patientName,
    initials: patient.initials || patientInitials(patientName),
    phone: item.phone || patient.phone || customer.phone || "",
    email: item.email || patient.email || customer.email || "",
    status: item.status || "PENDING",
    submittedAt: item.submitted_at || item.created_at,
    trackKey: item.track_key || "weight-loss",
    currentMedication: item.current_medication || item.medication_name || item.product_name || item.current_care_plan?.title || "",
    currentDose: item.current_dose || item.dose || item.current_care_plan?.dose || "",
    dosageAdjustment: answerLabel("dosage_adjustment", dosageAdjustment),
    deliveryExperience: answerLabel("delivery_experience", deliveryExperience),
    progress: answerLabel("weight_loss_last_month", progress),
    currentWeight: formatWeight(currentWeight),
    sideEffects: answerLabel("side_effects", sideEffects),
    doctorMessage: readAnswer(questionnaire, ["doctor_message", "message_to_doctor", "message"]),
  };
}

function RefillRequestDetail({ request, onPrescribe }) {
  const { I, Avatar } = window.DD_UI;
  if (!request) {
    return (
      <div className="refill-detail-empty">
        <div className="refill-detail-icon">{I.drop}</div>
        <div>Select a refill request</div>
        <p>Review the patient answers, then prescribe from this queue.</p>
      </div>
    );
  }

  const canPrescribe = Boolean(request.patientId);
  return (
    <div className="refill-detail">
      <div className="refill-detail-head">
        <Avatar initials={request.initials} name={request.patientName} size="lg" />
        <div>
          <div className="refill-detail-name">{request.patientName}</div>
          <div className="refill-detail-meta">
            {[request.phone, request.email, `Submitted ${formatDateTime(request.submittedAt)}`].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      <div className="refill-status-strip">
        <span>{titleCase(request.status)}</span>
        <strong>Weight loss refill</strong>
      </div>

      <div className="refill-kv-list">
        <div className="kv-row"><div className="k">Current medication</div><div className="v">{request.currentMedication || "Not provided"}</div></div>
        <div className="kv-row"><div className="k">Dose request</div><div className="v">{request.dosageAdjustment || "Not provided"}</div></div>
        <div className="kv-row"><div className="k">Delivery</div><div className="v">{request.deliveryExperience || "Not provided"}</div></div>
        <div className="kv-row"><div className="k">1 month progress</div><div className="v">{request.progress || "Not provided"}</div></div>
        <div className="kv-row"><div className="k">Current weight</div><div className="v">{request.currentWeight || "Not provided"}</div></div>
        <div className="kv-row"><div className="k">Side effects</div><div className="v">{request.sideEffects || "Not provided"}</div></div>
      </div>

      <div className="refill-note">
        <div className="label">Message to doctor</div>
        <p>{request.doctorMessage || "No message added."}</p>
      </div>

      <button
        className="dd-btn-block"
        disabled={!canPrescribe}
        title={canPrescribe ? "Prescribe refill medication" : "Missing patient id on this refill request"}
        onClick={() => onPrescribe(request.patientId, "weight-loss", request.customerId, request.id)}
      >
        Prescribe refill
      </button>
    </div>
  );
}

function RefillsView({ onPrescribe }) {
  const { I, Avatar, Topbar } = window.DD_UI;
  const [status, setStatus] = useStateF("pending");
  const [query, setQuery] = useStateF("");
  const [requests, setRequests] = useStateF([]);
  const [selectedId, setSelectedId] = useStateF("");
  const [loading, setLoading] = useStateF(true);
  const [error, setError] = useStateF("");

  const loadRefills = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        doctor_id: DOCTOR_ID,
        status,
        limit: "100",
        offset: "0",
      });
      if (query.trim()) params.set("q", query.trim());
      const data = await fetchJson(`${API_BASE}/doctor/rx/refill-requests?${params.toString()}`);
      const nextRequests = (data.requests || data.refill_requests || []).map(mapRefillRequest);
      setRequests(nextRequests);
      setSelectedId((current) => {
        if (current && nextRequests.some((request) => request.id === current)) return current;
        return nextRequests[0]?.id || "";
      });
    } catch (err) {
      setRequests([]);
      setSelectedId("");
      setError(
        err.status === 404
          ? "Refill request API is not available yet."
          : err.message || "Could not load refill requests."
      );
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffectF(() => {
    loadRefills();
  }, [loadRefills]);

  const selected = requests.find((request) => request.id === selectedId) || null;
  const filteredCount = useMemoF(() => requests.length, [requests]);

  return (
    <>
      <Topbar
        title="Refills"
        subtitle={loading ? "Loading refill requests" : `${filteredCount} refill request${filteredCount === 1 ? "" : "s"}`}
        right={<button type="button" className="btn-ghost" onClick={loadRefills}>{I.checks}<span>Refresh</span></button>}
      />
      <div className="refills-layout">
        <div className="refills-main dd-scroll">
          <div className="section-hdr"><div className="label">Refill requests</div></div>
          <div className="rx-track-tabs">
            {STATUS_FILTERS.map((filter) => (
              <button key={filter.key} className={status === filter.key ? "active" : ""} onClick={() => setStatus(filter.key)}>
                {filter.label}
              </button>
            ))}
          </div>
          <div className="rx-search" style={{ marginTop: 18 }}>
            <span className="rx-search-icon">{I.search}</span>
            <input
              className="rx-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search refill requests"
            />
          </div>

          {error && (
            <div className="api-state rx-api-state">
              <span>{error}</span>
              <button type="button" className="btn-ghost" onClick={loadRefills}>Retry</button>
            </div>
          )}

          <div className="refill-list">
            {loading ? (
              <div className="patient-loading"><div /><div /><div /></div>
            ) : error ? null : requests.length ? requests.map((request) => (
              <button
                key={request.id}
                className={`refill-row${selectedId === request.id ? " selected" : ""}`}
                onClick={() => setSelectedId(request.id)}
              >
                <Avatar initials={request.initials} name={request.patientName} size="md" />
                <div>
                  <div className="nm">{request.patientName}</div>
                  <div className="ds">
                    {[request.currentMedication || "Weight loss refill", request.dosageAdjustment, request.sideEffects].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="tm">
                  <span>{titleCase(request.status)}</span>
                  <strong>{formatDateTime(request.submittedAt)}</strong>
                </div>
              </button>
            )) : (
              <div className="empty-state rx-product-empty">No refill requests found.</div>
            )}
          </div>
        </div>

        <aside className="refills-side dd-scroll">
          <RefillRequestDetail request={selected} onPrescribe={onPrescribe} />
        </aside>
      </div>
    </>
  );
}

window.DD_RefillsView = RefillsView;
