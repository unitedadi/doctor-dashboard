import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";
import { fetchJson } from "../lib/authFetch.js";

/* global React */
const { useEffect: useEffectQ, useMemo: useMemoQ, useState: useStateQ } = React;

const STATUS_FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "prescribed", label: "Prescribed" },
  { key: "ineligible", label: "Ineligible" },
  { key: "no_show", label: "No show" },
  { key: "all", label: "All" },
];

const QUICK_WLP_LIST_FROM_DATE = "2026-06-08";
const QUICK_WLP_SOURCE_TAGS = [
  { key: "JUSTLIFE", label: "Justlife" },
  { key: "NOVO_NORDISK", label: "Novo Nordisk" },
  { key: "REGULAR", label: "Regular" },
];

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

function formatExpiry(value) {
  const formatted = formatDateTime(value);
  return formatted ? `Expires ${formatted}` : "Expiry unavailable";
}

function dubaiTodayYmd() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatSourceTag(value) {
  const normalized = String(value || "REGULAR").toUpperCase();
  if (normalized === "NOVO_NORDISK") return "Novo Nordisk";
  if (normalized === "JUSTLIFE") return "Justlife";
  return "Regular";
}

function quickConsultTrackLabel(value) {
  return String(value || "").toLowerCase() === "peptides" ? "Peptides" : "Weight Loss";
}

function formatMetric(value, suffix) {
  if (value === null || value === undefined || value === "") return "";
  return `${value}${suffix}`;
}

function isWegovyMedication(value) {
  return /\bwegovy\b/i.test(String(value || ""));
}

function patientInitials(name) {
  const parts = String(name || "Patient").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "Q") + (parts[1]?.[0] || "");
}

function MedicationLabel({ medication, fallback = "Not provided", compact = false }) {
  const name = medication || fallback;
  return (
    <span className={`quickwlp-medication${compact ? " compact" : ""}`}>
      <span>{name}</span>
      {isWegovyMedication(name) && <span className="quickwlp-maker-pill">Novo Nordisk</span>}
    </span>
  );
}

function mapQuickWlpPrescription(item) {
  return {
    id: item.prescription_id,
    prescriptionId: item.prescription_id,
    checkoutUrl: item.checkout_url || "",
    checkoutExpiresAt: item.checkout_expires_at || "",
    itemLabel: item.item_label || "Prescription checkout",
    status: item.status || "ACTIVE",
    canRecreate: item.can_recreate === true,
    createdAt: item.created_at || "",
    recreatedFromPrescriptionId: item.recreated_from_prescription_id || "",
    items: Array.isArray(item.items) ? item.items : [],
  };
}

function mapQuickWlpRequest(item) {
  const patient = item.patient || {};
  const assessment = item.assessment || {};
  const name = patient.name || "QuickWLP customer";
  return {
    id: item.lead_id || item.request_id,
    leadId: item.lead_id || item.request_id,
    consultationId: item.consultation_id,
    doctorId: item.doctor_id || "",
    trackKey: item.track_key || "weight-loss",
    status: item.status || "PENDING",
    scheduledAt: item.scheduled_start_at,
    scheduledEnd: item.scheduled_end_at,
    doctorName: item.doctor_name,
    currentStage: item.current_stage,
    doctorOutcome: item.doctor_outcome,
    doctorFeedback: item.doctor_feedback,
    prescriptionLink: item.prescription_link,
    paymentStatus: item.payment_status,
    nextAction: item.next_action,
    patient: {
      name,
      initials: patient.initials || patientInitials(name),
      phone: patient.phone || "",
      userPhone: patient.user_phone || "",
      whatsapp: patient.whatsapp || "",
      email: patient.email || "",
      gender: titleCase(patient.gender),
      age: patient.age,
      dateOfBirth: patient.date_of_birth,
    },
    assessment: {
      preferredMedication: assessment.preferred_medication || "",
      height: formatMetric(assessment.height_cm, " cm"),
      weight: formatMetric(assessment.weight_kg, " kg"),
      bmi: assessment.bmi,
    },
    sourceTag: item.source_tag || "REGULAR",
    prescriptions: (item.prescriptions || []).map(mapQuickWlpPrescription),
  };
}

function QuickWlpPrescriptionHistory({ prescriptions, onRecreate, recreatingId }) {
  const list = Array.isArray(prescriptions) ? prescriptions : [];
  if (!list.length) {
    return <div className="quickwlp-prescription-empty">No checkout link created yet.</div>;
  }

  return (
    <div className="quickwlp-prescription-list">
      {list.map((prescription) => {
        const status = String(prescription.status || "ACTIVE").toLowerCase();
        return (
          <div key={prescription.id} className="quickwlp-prescription-row">
            <div>
              <div className="quickwlp-prescription-title">{prescription.itemLabel}</div>
              <div className="quickwlp-prescription-meta">
                {[formatExpiry(prescription.checkoutExpiresAt), prescription.createdAt ? `Created ${formatDateTime(prescription.createdAt)}` : ""].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="quickwlp-prescription-actions">
              <span className={`quickwlp-prescription-status ${status}`}>{titleCase(prescription.status)}</span>
              {prescription.checkoutUrl && (
                <a className="quickwlp-prescription-open" href={prescription.checkoutUrl} target="_blank" rel="noreferrer">
                  Open
                </a>
              )}
              {prescription.canRecreate && (
                <button
                  type="button"
                  className="btn-ghost quickwlp-prescription-recreate"
                  disabled={recreatingId === prescription.id}
                  onClick={() => onRecreate?.(prescription.id)}
                >
                  {recreatingId === prescription.id ? "Recreating..." : "Recreate"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuickWlpRequestDetail({ request, onFinalize, onPrescribe, onRecreate, recreatingId }) {
  const { I, Avatar } = window.DD_UI;
  const [saving, setSaving] = useStateQ("");

  useEffectQ(() => {
    setSaving("");
  }, [request?.id]);

  if (!request) {
    return (
      <div className="refill-detail-empty">
        <div className="refill-detail-icon">{I.stethoscope}</div>
        <div>Select a Quick WLP request</div>
        <p>Review the booked consultation details, then update the doctor outcome.</p>
      </div>
    );
  }

  const submit = async (value, label) => {
    setSaving(label);
    try {
      await onFinalize(request, value);
    } finally {
      setSaving("");
    }
  };

  return (
    <div className="refill-detail">
      <div className="refill-detail-head">
        <Avatar initials={request.patient.initials} name={request.patient.name} size="lg" />
        <div>
          <div className="refill-detail-name">{request.patient.name}</div>
          <div className="refill-detail-meta">
            {[request.patient.phone, request.patient.email, `Booked ${formatDateTime(request.scheduledAt)}`].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      <div className="refill-status-strip">
          <span>{titleCase(request.status)}</span>
          <strong>{quickConsultTrackLabel(request.trackKey)} · Quick Consult</strong>
      </div>

      <div className="refill-kv-list">
        <div className="kv-row"><div className="k">Consultation</div><div className="v">{formatDateTime(request.scheduledAt) || "Not provided"}</div></div>
        <div className="kv-row"><div className="k">Medication requested</div><div className="v"><MedicationLabel medication={request.assessment.preferredMedication} /></div></div>
        <div className="kv-row"><div className="k">Source tag</div><div className="v">{formatSourceTag(request.sourceTag)}</div></div>
        <div className="kv-row"><div className="k">Phone number</div><div className="v">{request.patient.userPhone || request.patient.phone || "Not provided"}</div></div>
        <div className="kv-row"><div className="k">WhatsApp</div><div className="v">{request.patient.whatsapp || "Not provided"}</div></div>
        <div className="kv-row"><div className="k">Gender / age</div><div className="v">{[request.patient.gender, request.patient.age ? `${request.patient.age}y` : ""].filter(Boolean).join(" · ") || "Not provided"}</div></div>
        <div className="kv-row"><div className="k">Height / weight</div><div className="v">{[request.assessment.height, request.assessment.weight].filter(Boolean).join(" · ") || "Not provided"}</div></div>
        <div className="kv-row"><div className="k">BMI</div><div className="v">{request.assessment.bmi || "Not provided"}</div></div>
        <div className="kv-row"><div className="k">Next action</div><div className="v">{request.nextAction || "Not provided"}</div></div>
      </div>

      <div className="refill-note quickwlp-outcome-box">
        <div className="label">Prescription checkout</div>
        <p>Create the cart here and DarDoc will send the checkout link to the customer on WhatsApp and email.</p>
        <QuickWlpPrescriptionHistory
          prescriptions={request.prescriptions}
          onRecreate={(prescriptionId) => onRecreate?.(prescriptionId, request.doctorId)}
          recreatingId={recreatingId}
        />
        <button className="dd-btn-block" disabled={Boolean(saving)} onClick={() => onPrescribe?.(request)}>
          Issue prescription
        </button>
      </div>

      <div className="quickwlp-action-row">
        <button className="btn-ghost" disabled={Boolean(saving)} onClick={() => submit("No show", "no_show")}>
          {saving === "no_show" ? "Saving..." : "Mark no show"}
        </button>
        <button className="btn-ghost danger" disabled={Boolean(saving)} onClick={() => submit("ineligible", "ineligible")}>
          {saving === "ineligible" ? "Saving..." : "Mark ineligible"}
        </button>
      </div>
    </div>
  );
}

function QuickWlpCreateConsultationDialog({ open, onClose, onCreated }) {
  const [phone, setPhone] = useStateQ("");
  const [name, setName] = useStateQ("");
  const [email, setEmail] = useStateQ("");
  const [customer, setCustomer] = useStateQ(null);
  const [needsProfile, setNeedsProfile] = useStateQ(false);
  const [slots, setSlots] = useStateQ([]);
  const [selectedSlot, setSelectedSlot] = useStateQ("");
  const [sourceTag, setSourceTag] = useStateQ("REGULAR");
  const [step, setStep] = useStateQ("lookup");
  const [busy, setBusy] = useStateQ(false);
  const [error, setError] = useStateQ("");

  useEffectQ(() => {
    if (!open) return;
    setPhone("");
    setName("");
    setEmail("");
    setCustomer(null);
    setNeedsProfile(false);
    setSlots([]);
    setSelectedSlot("");
    setSourceTag("REGULAR");
    setStep("lookup");
    setBusy(false);
    setError("");
  }, [open]);

  if (!open) return null;

  const loadSlots = async () => {
    const params = new URLSearchParams({
      doctor_id: DOCTOR_ID,
      start_date: dubaiTodayYmd(),
      days: "7",
    });
    const data = await fetchJson(`${API_BASE}/doctor/quickwlp/admin/slots?${params.toString()}`);
    setSlots(Array.isArray(data.slots) ? data.slots : []);
    setSelectedSlot((current) => current || data.slots?.[0]?.slot_start || "");
    setStep("schedule");
  };

  const lookupCustomer = async () => {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      setError("Enter the customer's phone number.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({
        doctor_id: DOCTOR_ID,
        phone_number: normalizedPhone,
      });
      const data = await fetchJson(`${API_BASE}/doctor/quickwlp/admin/customer?${params.toString()}`);
      if (data.exists && data.customer) {
        setCustomer(data.customer);
        setNeedsProfile(false);
        setName(data.customer.full_name || "");
        setEmail(data.customer.email || "");
        await loadSlots();
      } else {
        setCustomer(null);
        setNeedsProfile(true);
        setStep("profile");
      }
    } catch (err) {
      setError(err.message || "Could not check this customer.");
    } finally {
      setBusy(false);
    }
  };

  const continueWithProfile = async () => {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required for a new customer.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await loadSlots();
    } catch (err) {
      setError(err.message || "Could not load Quick WLP slots.");
    } finally {
      setBusy(false);
    }
  };

  const createConsultation = async () => {
    if (!selectedSlot) {
      setError("Select an available slot.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await fetchJson(`${API_BASE}/doctor/quickwlp/admin/consultations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctor_id: DOCTOR_ID,
          phone_number: phone.trim(),
          name: name.trim() || customer?.full_name || undefined,
          email: email.trim() || customer?.email || undefined,
          slot_start: selectedSlot,
          source_tag: sourceTag,
        }),
      });
      await onCreated?.();
    } catch (err) {
      setError(err.message || "Could not create Quick WLP consultation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="quickwlp-dialog-backdrop" role="presentation">
      <div className="quickwlp-dialog" role="dialog" aria-modal="true" aria-label="Create Quick WLP consultation">
        <div className="quickwlp-dialog-head">
          <div>
            <div className="quickwlp-dialog-title">New Quick WLP consultation</div>
            <p>Find an existing customer by phone, or create a lightweight profile before booking.</p>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Close</button>
        </div>

        <div className="quickwlp-dialog-fields">
          <label>
            <span>Phone number</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+971..." disabled={busy || step !== "lookup"} />
          </label>
          {step === "lookup" && (
            <button type="button" className="btn-primary quickwlp-dialog-primary" onClick={lookupCustomer} disabled={busy}>
              {busy ? "Checking..." : "Check customer"}
            </button>
          )}
        </div>

        {customer && (
          <div className="quickwlp-customer-card">
            <span>Existing customer</span>
            <strong>{customer.full_name || "Customer"}</strong>
            <small>{[customer.phone, customer.email].filter(Boolean).join(" · ")}</small>
          </div>
        )}

        {needsProfile && (
          <div className="quickwlp-dialog-grid">
            <label>
              <span>Full name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Customer name" disabled={busy} />
            </label>
            <label>
              <span>Email</span>
              <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="customer@email.com" disabled={busy} />
            </label>
            {step === "profile" && (
              <button type="button" className="btn-primary quickwlp-dialog-primary" onClick={continueWithProfile} disabled={busy}>
                {busy ? "Loading..." : "Continue"}
              </button>
            )}
          </div>
        )}

        {step === "schedule" && (
          <>
            <div className="quickwlp-dialog-section">
              <div className="label">Available slots</div>
              <div className="quickwlp-slot-list">
                {slots.length ? slots.map((slot) => (
                  <button
                    key={slot.slot_start}
                    type="button"
                    className={`quickwlp-slot-button${selectedSlot === slot.slot_start ? " selected" : ""}`}
                    onClick={() => setSelectedSlot(slot.slot_start)}
                  >
                    {formatDateTime(slot.slot_start)}
                  </button>
                )) : (
                  <div className="quickwlp-dialog-empty">No Quick WLP slots available in the next 7 days.</div>
                )}
              </div>
            </div>

            <div className="quickwlp-dialog-section">
              <div className="label">Source tag</div>
              <div className="quickwlp-tag-row">
                {QUICK_WLP_SOURCE_TAGS.map((tag) => (
                  <button
                    key={tag.key}
                    type="button"
                    className={`quickwlp-tag-button${sourceTag === tag.key ? " selected" : ""}`}
                    onClick={() => setSourceTag(tag.key)}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error && <div className="quickwlp-dialog-error">{error}</div>}

        {step === "schedule" && (
          <div className="quickwlp-dialog-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="btn-primary" onClick={createConsultation} disabled={busy || !selectedSlot}>
              {busy ? "Creating..." : "Create consultation"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickWlpView({ onPrescribe }) {
  const { I, Avatar, Topbar } = window.DD_UI;
  const [status, setStatus] = useStateQ("pending");
  const [query, setQuery] = useStateQ("");
  const [requests, setRequests] = useStateQ([]);
  const [selectedId, setSelectedId] = useStateQ("");
  const [loading, setLoading] = useStateQ(true);
  const [error, setError] = useStateQ("");
  const [recreatingId, setRecreatingId] = useStateQ("");

  const loadRequests = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        doctor_id: DOCTOR_ID,
        status,
        from: QUICK_WLP_LIST_FROM_DATE,
        limit: "100",
        offset: "0",
      });
      if (query.trim()) params.set("q", query.trim());
      const data = await fetchJson(`${API_BASE}/doctor/quickwlp/requests?${params.toString()}`);
      const nextRequests = (data.requests || []).map(mapQuickWlpRequest);
      setRequests(nextRequests);
      setSelectedId((current) => {
        if (current && nextRequests.some((request) => request.id === current)) return current;
        return nextRequests[0]?.id || "";
      });
    } catch (err) {
      setRequests([]);
      setSelectedId("");
      setError(err.message || "Could not load Quick WLP requests.");
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffectQ(() => {
    loadRequests();
  }, [loadRequests]);

  const selected = requests.find((request) => request.id === selectedId) || null;
  const requestCount = useMemoQ(() => requests.length, [requests]);

  const finalizeRequest = async (request, value) => {
    const doctorId = request?.doctorId || DOCTOR_ID;
    await fetchJson(`${API_BASE}/doctor/quickwlp/requests/${encodeURIComponent(request.leadId)}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctor_id: doctorId,
        value,
      }),
    });
    await loadRequests();
  };

  const recreatePrescription = async (prescriptionId, doctorId = DOCTOR_ID) => {
    if (!prescriptionId) return;
    setRecreatingId(prescriptionId);
    setError("");
    try {
      await fetchJson(`${API_BASE}/doctor/quickwlp/prescriptions/${encodeURIComponent(prescriptionId)}/recreate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctor_id: doctorId || DOCTOR_ID }),
      });
      await loadRequests();
    } catch (err) {
      setError(err.message || "Could not recreate checkout link.");
    } finally {
      setRecreatingId("");
    }
  };

  return (
    <>
      <Topbar
        title="Quick Consult"
        subtitle={loading ? "Loading Quick Consult requests" : `${requestCount} request${requestCount === 1 ? "" : "s"} from Jun 8`}
        right={(
          <div className="quickwlp-topbar-actions">
            <button type="button" className="btn-ghost" onClick={loadRequests}>{I.checks}<span>Refresh</span></button>
          </div>
        )}
      />
      <div className="refills-layout">
        <div className="refills-main dd-scroll">
          <div className="section-hdr"><div className="label">Quick Consult requests</div></div>
          <div className="rx-track-tabs quickwlp-tabs">
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
              placeholder="Search Quick Consult requests"
            />
          </div>

          {error && (
            <div className="api-state rx-api-state">
              <span>{error}</span>
              <button type="button" className="btn-ghost" onClick={loadRequests}>Retry</button>
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
                <Avatar initials={request.patient.initials} name={request.patient.name} size="md" />
                <div>
                  <div className="nm">{request.patient.name}</div>
                  <div className="ds">
                    <MedicationLabel medication={request.assessment.preferredMedication || quickConsultTrackLabel(request.trackKey)} compact />
                    {[request.patient.phone, request.patient.whatsapp].filter(Boolean).map((value, index) => (
                      <React.Fragment key={`${value}-${index}`}> · {value}</React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="tm">
                  <span>{titleCase(request.status)}</span>
                  <strong>{formatDateTime(request.scheduledAt)}</strong>
                </div>
              </button>
            )) : (
              <div className="empty-state rx-product-empty">No Quick Consult requests found.</div>
            )}
          </div>
        </div>

        <aside className="refills-side dd-scroll">
          <QuickWlpRequestDetail
            request={selected}
            onFinalize={finalizeRequest}
            onPrescribe={onPrescribe}
            onRecreate={recreatePrescription}
            recreatingId={recreatingId}
          />
        </aside>
      </div>
    </>
  );
}

window.DD_QuickWlpView = QuickWlpView;
