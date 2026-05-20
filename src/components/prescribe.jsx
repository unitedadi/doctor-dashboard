import * as React from "react";
import { API_BASE, DOCTOR_ID } from "../config.js";

/* global React */
const { useEffect: useEffectR, useMemo: useMemoR, useState: useStateR } = React;

const TRACKS = [
  { key: "weight-loss", label: "Weight loss", summary: "Doctor-prescribed weight loss medication with ongoing support." },
  { key: "peptides", label: "Peptides", summary: "Doctor-prescribed peptide care plan with ongoing support." },
];
const ALL_TRACK = "all";

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.detail || `request_failed_${response.status}`);
  return data;
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPrice(fils) {
  if (typeof fils !== "number") return "";
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(fils / 100);
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

function mapPrescribablePatient(item) {
  return {
    key: `${item.patient_id}:${item.track_key}`,
    id: item.patient_id,
    customerId: item.customer_id,
    name: item.name || "Unknown patient",
    initials: item.initials || "P",
    age: item.age,
    sex: titleCase(item.sex),
    phone: item.phone,
    trackKey: item.track_key,
    doctorId: item.doctor_id,
    subscriptionId: item.subscription_id,
    subscriptionStatus: item.subscription_status,
    latestCompletedConsultationId: item.latest_completed_consultation_id,
    latestCompletedAt: item.latest_completed_at,
    canPrescribe: item.can_prescribe === true,
  };
}

function productDetails(product, trackKey) {
  const attrs = product.attributes_json || {};
  const source = trackKey === "peptides" ? attrs.peptide : attrs.weight_loss;
  const dosage = source?.dosage || {};
  const specs = source?.specs || [];
  const strength = dosage.strength || specs.find((item) => item.label === "Strength")?.value;
  const frequency = dosage.frequency || specs.find((item) => item.label === "How to use")?.value;
  return {
    name: product.name,
    price: formatPrice(product.price_fils),
    strength,
    frequency,
    packSize: dosage.packSize || specs.find((item) => item.label === "Quantity")?.value,
    category: titleCase(attrs.category || product.category),
    instructions: source?.clinical?.dosingNote || "Use as directed by your DarDoc physician.",
  };
}

function errorCopy(error) {
  const copy = {
    doctor_not_found: "Doctor profile is missing or inactive.",
    doctor_track_not_enabled: "Dr. Sami is not enabled for this Rx track yet.",
    rx_prescription_completed_consultation_required: "A completed consultation is required before publishing this care plan.",
    rx_prescription_product_not_allowed_for_track: "One of the selected products is not allowed for this track.",
    rx_prescription_product_not_found: "One of the selected products is no longer available in the catalog.",
  };
  return copy[error] || error || "Could not publish this prescription.";
}

function PrescribeView({ initialPatientId, onSent }) {
  const { I, Avatar, Topbar } = window.DD_UI;
  const [patients, setPatients] = useStateR([]);
  const [selectedPatientKey, setSelectedPatientKey] = useStateR("");
  const [patientTrackFilter, setPatientTrackFilter] = useStateR(ALL_TRACK);
  const [patientQuery, setPatientQuery] = useStateR("");
  const [trackKey, setTrackKey] = useStateR("weight-loss");
  const [query, setQuery] = useStateR("");
  const [products, setProducts] = useStateR([]);
  const [selectedProduct, setSelectedProduct] = useStateR(null);
  const [quantity, setQuantity] = useStateR(1);
  const [instructions, setInstructions] = useStateR("");
  const [cart, setCart] = useStateR([]);
  const [patientsLoading, setPatientsLoading] = useStateR(true);
  const [productsLoading, setProductsLoading] = useStateR(false);
  const [publishing, setPublishing] = useStateR(false);
  const [error, setError] = useStateR("");
  const [sentToast, setSentToast] = useStateR("");

  const patient = patients.find((item) => item.key === selectedPatientKey) || null;
  const activeTrack = TRACKS.find((track) => track.key === trackKey) || TRACKS[0];

  const loadPatients = React.useCallback(async () => {
    setPatientsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        doctor_id: DOCTOR_ID,
        limit: "50",
        offset: "0",
      });
      if (patientTrackFilter !== ALL_TRACK) params.set("track_key", patientTrackFilter);
      if (patientQuery.trim()) params.set("q", patientQuery.trim());
      const data = await fetchJson(`${API_BASE}/doctor/rx/prescribable-patients?${params.toString()}`);
      const nextPatients = (data.patients || []).map(mapPrescribablePatient);
      setPatients(nextPatients);
      setSelectedPatientKey((current) => {
        const deepLinked = initialPatientId ? nextPatients.find((item) => item.id === initialPatientId) : null;
        if (deepLinked) return deepLinked.key;
        if (current && nextPatients.some((item) => item.key === current)) return current;
        return "";
      });
    } catch (err) {
      setError(errorCopy(err.message) || "Could not load prescribable patients.");
    } finally {
      setPatientsLoading(false);
    }
  }, [initialPatientId, patientQuery, patientTrackFilter]);

  useEffectR(() => {
    loadPatients();
  }, [loadPatients]);

  useEffectR(() => {
    if (!initialPatientId) setSelectedPatientKey("");
  }, [initialPatientId]);

  useEffectR(() => {
    if (!patient) return;
    setTrackKey(patient.trackKey);
    setCart([]);
    setSelectedProduct(null);
    setInstructions("");
  }, [patient?.key]);

  useEffectR(() => {
    let cancelled = false;
    const loadProducts = async () => {
      setProductsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          doctor_id: DOCTOR_ID,
          limit: "50",
          offset: "0",
        });
        if (query.trim()) params.set("q", query.trim());
        const data = await fetchJson(`${API_BASE}/doctor/rx/tracks/${trackKey}/prescribable-products?${params.toString()}`);
        if (!cancelled) setProducts(data.products || []);
      } catch (err) {
        if (!cancelled) {
          setProducts([]);
          setError(errorCopy(err.message) || "Could not load prescribable products.");
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    };
    if (patient) loadProducts();
    else {
      setProducts([]);
      setProductsLoading(false);
    }
    return () => { cancelled = true; };
  }, [patient, trackKey, query]);

  const visibleProducts = useMemoR(() => {
    return products
      .map((product) => ({ ...product, details: productDetails(product, trackKey) }));
  }, [products, trackKey]);

  const cartTotal = cart.reduce((sum, item) => sum + ((item.price_fils || 0) * item.quantity), 0);

  const chooseTrack = (nextTrack) => {
    setPatientTrackFilter(nextTrack);
    setSelectedPatientKey("");
    setCart([]);
    setSelectedProduct(null);
    setInstructions("");
  };

  const pickProduct = (product) => {
    setSelectedProduct(product);
    setQuantity(1);
    setInstructions(product.details.instructions);
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    const item = {
      id: selectedProduct.product_id,
      product_id: selectedProduct.product_id,
      vertical_id: selectedProduct.vertical_id,
      name: selectedProduct.name,
      price_fils: selectedProduct.price_fils,
      quantity,
      doctor_instructions: instructions.trim() || selectedProduct.details.instructions,
      details: selectedProduct.details,
    };
    setCart((current) => {
      const withoutCurrent = current.filter((entry) => entry.product_id !== item.product_id);
      return [...withoutCurrent, item];
    });
    setSelectedProduct(null);
    setInstructions("");
    setQuery("");
  };

  const removeCart = (id) => setCart((current) => current.filter((item) => item.id !== id));

  const publishPrescription = async () => {
    if (!patient || !cart.length) return;
    setPublishing(true);
    setError("");
    setSentToast("");
    try {
      const payload = {
        doctor_id: DOCTOR_ID,
        customer_id: patient.customerId,
        title: `${activeTrack.label} Rx plan`,
        summary: activeTrack.summary,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          doctor_instructions: item.doctor_instructions,
        })),
      };
      const data = await fetchJson(`${API_BASE}/doctor/patients/${patient.id}/rx/tracks/${trackKey}/prescriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setCart([]);
      setSelectedProduct(null);
      setSentToast(data.care_plan?.title || `${activeTrack.label} care plan published`);
      setTimeout(() => setSentToast(""), 2600);
      await loadPatients();
      if (onSent) onSent();
    } catch (err) {
      setError(errorCopy(err.message));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <Topbar
        title="Prescribe"
        subtitle={patientsLoading ? "Loading eligible patients" : "Select a completed consultation, then publish an Rx care plan"}
      />
      <div className="rx-layout">
        <div className="rx-main">
          <div className="rx-main-scroll dd-scroll">
            {error && (
              <div className="api-state rx-api-state">
                <span>{errorCopy(error)}</span>
                <button type="button" className="btn-ghost" onClick={loadPatients}>Retry</button>
              </div>
            )}

            {!patient ? (
              <>
                <div className="section-hdr"><div className="label">Prescribable patients</div></div>
                <div className="rx-track-tabs">
                  <button className={patientTrackFilter === ALL_TRACK ? "active" : ""} onClick={() => chooseTrack(ALL_TRACK)}>All</button>
                  {TRACKS.map((track) => (
                    <button key={track.key} className={patientTrackFilter === track.key ? "active" : ""} onClick={() => chooseTrack(track.key)}>
                      {track.label}
                    </button>
                  ))}
                </div>
                <div className="rx-search" style={{ marginTop: 18 }}>
                  <span className="rx-search-icon">{I.search}</span>
                  <input
                    className="rx-search-input"
                    value={patientQuery}
                    onChange={(event) => {
                      setPatientQuery(event.target.value);
                      setSelectedPatientKey("");
                    }}
                    placeholder="Search patients with completed consultations"
                  />
                </div>

                <div className="rx-patient-list">
                  {patientsLoading ? (
                    <div className="patient-loading"><div /><div /><div /></div>
                  ) : patients.length ? patients.map((item) => {
                    const track = TRACKS.find((entry) => entry.key === item.trackKey);
                    return (
                      <button key={item.key} className="rx-patient-row" onClick={() => setSelectedPatientKey(item.key)}>
                        <Avatar initials={item.initials} name={item.name} size="md" />
                        <div>
                          <div className="nm">{item.name}</div>
                          <div className="ds">
                            {[item.age, item.sex, track?.label, item.subscriptionStatus ? titleCase(item.subscriptionStatus) : null].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div className="tm">
                          <span>Completed</span>
                          <strong>{formatDateTime(item.latestCompletedAt)}</strong>
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="empty-state rx-product-empty">No patients are ready for prescribing.</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="rx-patient-card">
                  <Avatar initials={patient.initials} name={patient.name} size="lg" />
                  <div>
                    <div className="nm">{patient.name}</div>
                    <div className="me">
                      {[patient.age, patient.sex, activeTrack.label, `Completed ${formatDateTime(patient.latestCompletedAt)}`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <button className="btn-ghost rx-change-patient" onClick={() => setSelectedPatientKey("")}>Change patient</button>
                </div>

                <div className="section-hdr"><div className="label">Prescribable products</div></div>
                <div className="rx-search">
                  <span className="rx-search-icon">{I.search}</span>
                  <input
                    className="rx-search-input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={`Search ${activeTrack.label.toLowerCase()} products`}
                  />
                </div>

                <div className="rx-product-list">
                  {productsLoading ? (
                    <div className="patient-loading"><div /><div /><div /></div>
                  ) : visibleProducts.length ? visibleProducts.map((product) => (
                    <button key={product.product_id} className="rx-product-row" onClick={() => pickProduct(product)}>
                      <div>
                        <div className="nm">{product.name}</div>
                        <div className="ds">
                          {[product.details.strength, product.details.frequency, product.details.packSize].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="rx-product-price">{product.details.price}</div>
                    </button>
                  )) : (
                    <div className="empty-state rx-product-empty">No products found for this track.</div>
                  )}
                </div>
              </>
            )}
          </div>

          {patient && selectedProduct && (
            <div className="rx-selection-tray fade-in" key={selectedProduct.product_id}>
              <div className="rx-selection-head">
                <div>
                  <div className="rx-selection-title">{selectedProduct.name}</div>
                  <div className="rx-selection-meta">
                    {[selectedProduct.details.price, selectedProduct.details.category].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <button className="btn-ghost" onClick={() => setSelectedProduct(null)}>Change</button>
              </div>

              <div className="rx-form-grid two">
                <div className="field-block">
                  <label>Quantity</label>
                  <div className="rx-stepper">
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      {I.minus}
                    </button>
                    <span>{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => Math.min(5, current + 1))}
                      disabled={quantity >= 5}
                      aria-label="Increase quantity"
                    >
                      {I.plus}
                    </button>
                  </div>
                </div>
                <div className="field-block">
                  <label>Doctor instructions</label>
                  <input value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Use as directed by your DarDoc physician." />
                </div>
              </div>

              <div className="rx-plan-note">
                {selectedProduct.details.instructions}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button className="btn-ghost" onClick={() => setSelectedProduct(null)}>Cancel</button>
                <button className="btn-primary" onClick={addToCart}>{I.plus}<span>Add to plan</span></button>
              </div>
            </div>
          )}
        </div>

        <div className="rx-side dd-scroll">
          <div className="section-hdr"><div className="label">Care plan</div></div>
          <div className="rx-cart">
            {!patient ? (
              <div className="empty">Choose a patient with a completed consultation to begin.</div>
            ) : cart.length === 0 ? (
              <div className="empty">No products added yet.<br/>Select catalog products to build the plan.</div>
            ) : cart.map((item) => (
              <div key={item.id} className="rx-cart-item">
                <span className="x" onClick={() => removeCart(item.id)}>{I.x}</span>
                <div className="nm">{item.name}</div>
                <div className="ds">Qty {item.quantity} · {formatPrice(item.price_fils * item.quantity)}</div>
                <div className="ds" style={{ marginTop: 2 }}>{item.doctor_instructions}</div>
              </div>
            ))}
            {cart.length > 0 && (
              <div className="rx-summary">
                <span>{cart.length} item{cart.length === 1 ? "" : "s"}</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
            <button
              className="dd-btn-block"
              disabled={!cart.length || publishing || !patient?.customerId}
              style={{ opacity: cart.length && !publishing ? 1 : 0.4, cursor: cart.length && !publishing ? "pointer" : "not-allowed" }}
              onClick={publishPrescription}
            >
              {publishing ? "Publishing..." : "Publish care plan"}
            </button>
          </div>

          {patient && (
            <>
              <h4 style={{ font: "400 11px/1 var(--dd-font)", textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--dd-text-tertiary)", margin: "28px 0 12px" }}>Eligibility</h4>
              <div className="kv-row"><div className="k">Track</div><div className="v">{activeTrack.label}</div></div>
              <div className="kv-row"><div className="k">Subscription</div><div className="v">{titleCase(patient.subscriptionStatus)}</div></div>
              <div className="kv-row"><div className="k">Completed</div><div className="v">{formatDateTime(patient.latestCompletedAt)}</div></div>
            </>
          )}
        </div>
      </div>

      {sentToast && (
        <div className="toast">
          {I.check}<span>{sentToast}</span>
        </div>
      )}
    </>
  );
}

window.DD_PrescribeView = PrescribeView;
