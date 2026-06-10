import * as React from "react";
import { API_BASE, DOCTOR_ID, NEEDLES_PRODUCT_ID, SUPPLEMENT_SELLER_ID } from "../config.js";

/* global React */
const { useEffect: useEffectR, useMemo: useMemoR, useState: useStateR } = React;

const TRACKS = [
  { key: "weight-loss", label: "Weight loss", summary: "Doctor-prescribed weight loss medication with ongoing support." },
  { key: "peptides", label: "Peptides", summary: "Doctor-prescribed peptide care plan with ongoing support." },
];
const SUPPLEMENTS_CATALOG = {
  key: "supplements",
  label: "Supplements",
  summary: "Doctor-prescribed supplements with shipment support.",
};
const NEEDLES_CATALOG = {
  key: "needles",
  label: "Needles",
};
const AUTO_NEEDLES_CART_ID = `auto-needles:${NEEDLES_PRODUCT_ID}`;
const ALL_TRACK = "all";

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.detail || `request_failed_${response.status}`);
    error.payload = data;
    throw error;
  }
  return data;
}

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function patientInitials(name) {
  const parts = String(name || "Patient").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "P") + (parts[1]?.[0] || "");
}

function formatPrice(fils) {
  if (typeof fils !== "number" || !Number.isFinite(fils)) return "";
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(fils / 100);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inventoryAvailability(product) {
  const inventory = product?.inventory || product?.seller_offer?.inventory || {};
  const available = toNumber(
    inventory.available_qty
      ?? inventory.total_available_qty
      ?? inventory.available
      ?? product?.available_qty
  );
  return available === undefined ? undefined : Math.max(0, Math.floor(available));
}

function supplementQuantityLimit(product) {
  const available = inventoryAvailability(product);
  if (available === undefined) return 5;
  return Math.max(0, Math.min(5, available));
}

function productQuantityLimit(product, catalogKey) {
  if (catalogKey !== SUPPLEMENTS_CATALOG.key) return 5;
  return supplementQuantityLimit(product);
}

function productStockLabel(product, catalogKey) {
  if (catalogKey !== SUPPLEMENTS_CATALOG.key) return "";
  const available = product?.available_qty;
  if (available === undefined) return "";
  return available === 1 ? "1 available" : `${available} available`;
}

function isOutOfStock(product, catalogKey) {
  return catalogKey === SUPPLEMENTS_CATALOG.key && product?.available_qty !== undefined && product.available_qty <= 0;
}

function compactList(value) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (item && typeof item === "object") return item.name || item.label || item.value || "";
      return "";
    })
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
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
  if (trackKey === NEEDLES_CATALOG.key) {
    return {
      name: product.name,
      price: formatPrice(product.price_fils),
      strength: "Injection supply",
      frequency: "Auto-added for Mounjaro",
      packSize: "Needles",
      category: "Needles",
      instructions: "Use as directed with the prescribed Mounjaro pen.",
    };
  }
  if (trackKey === SUPPLEMENTS_CATALOG.key) {
    const supplement = attrs.supplement || {};
    const ingredients = compactList(supplement.ingredients);
    const concentration = compactList(supplement.concentration);
    return {
      name: product.name,
      price: formatPrice(product.price_fils),
      strength: [ingredients, concentration].filter(Boolean).join(" · "),
      frequency: supplement.dosage || supplement.serving || "Supplement",
      packSize: supplement.pack_size || supplement.quantity || supplement.form,
      category: titleCase(supplement.category || attrs.category || product.category),
      instructions: supplement.instructions || "Use as directed by your DarDoc physician.",
    };
  }
  const productCategory = String(attrs.category || attrs.product_category || product.category || "").toUpperCase();
  const source = productCategory === "PEPTIDE" ? attrs.peptide : attrs.weight_loss;
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

function mapShipmentProduct(product) {
  const offer = product.seller_offer || {};
  const priceFils = toNumber(offer.price_aed_fils) ?? toNumber(product.price_fils);
  const productId = product.product_uuid || product.product_id;
  const availableQty = inventoryAvailability(product);
  return {
    product_id: productId,
    vertical_id: "shipments",
    name: offer.display_name || product.default_name || product.name || productId,
    price_fils: priceFils,
    vat_included: product.vat_included === true,
    active: String(product.status || "").toUpperCase() !== "INACTIVE",
    category: product.category,
    attributes_json: product.attributes_json || {},
    available_qty: availableQty,
    inventory: product.inventory || null,
  };
}

function mapSupplementProduct(product) {
  return mapShipmentProduct(product);
}

function isMounjaroProduct(product) {
  return /mounjaro/i.test(product?.name || "");
}

function requiredNeedlesQuantity(items) {
  return items.reduce((sum, item) => {
    if (item.autoAdded) return sum;
    return isMounjaroProduct(item) ? sum + item.quantity : sum;
  }, 0);
}

function makeAutoNeedlesCartItem(needlesProduct, quantity) {
  return {
    id: AUTO_NEEDLES_CART_ID,
    product_id: needlesProduct.product_id,
    vertical_id: needlesProduct.vertical_id,
    name: needlesProduct.name,
    price_fils: needlesProduct.price_fils,
    quantity,
    doctor_instructions: needlesProduct.details.instructions,
    details: needlesProduct.details,
    catalogKey: NEEDLES_CATALOG.key,
    autoAdded: true,
  };
}

function syncAutoNeedles(items, needlesProduct, dismissed = false) {
  const withoutAutoNeedles = items.filter((item) => item.id !== AUTO_NEEDLES_CART_ID);
  const quantity = requiredNeedlesQuantity(withoutAutoNeedles);
  if (!quantity || !needlesProduct || dismissed) return withoutAutoNeedles;
  return [...withoutAutoNeedles, makeAutoNeedlesCartItem(needlesProduct, quantity)];
}

function errorCopy(error, payload) {
  const copy = {
    doctor_not_found: "Doctor profile is missing or inactive.",
    doctor_track_not_enabled: "Dr. Sami is not enabled for this Rx track yet.",
    rx_prescription_completed_consultation_required: "A completed consultation is required before publishing this care plan.",
    rx_prescription_product_not_allowed_for_track: "One of the selected products is not allowed for this track.",
    rx_prescription_product_not_found: "One of the selected products is no longer available in the catalog.",
    rx_prescription_insufficient_inventory: payload?.product_name
      ? `${payload.product_name} has only ${payload.available_quantity ?? 0} available.`
      : "One of the selected supplements does not have enough stock.",
    quickwlp_request_not_found: "This Quick WLP request is no longer available.",
    quickwlp_prescription_product_not_allowed: "One of the selected products is not allowed for Quick WLP checkout.",
    quickwlp_prescription_product_not_found: "One of the selected products is no longer available in the catalog.",
  };
  return copy[error] || error || "Could not publish this prescription.";
}

function PrescribeView({
  initialPatientId,
  initialCustomerId,
  initialTrackKey,
  initialRefillRequestId,
  initialQuickWlpLeadId,
  initialQuickWlpName,
  initialQuickWlpPhone,
  initialQuickWlpWhatsapp,
  initialQuickWlpEmail,
  initialQuickWlpDoctorId,
  onSent,
}) {
  const { I, Avatar, Topbar } = window.DD_UI;
  const isQuickWlpMode = Boolean(initialQuickWlpLeadId);
  const [patients, setPatients] = useStateR([]);
  const [selectedPatientKey, setSelectedPatientKey] = useStateR("");
  const [patientTrackFilter, setPatientTrackFilter] = useStateR(ALL_TRACK);
  const [patientQuery, setPatientQuery] = useStateR("");
  const [trackKey, setTrackKey] = useStateR("weight-loss");
  const [productCatalogKey, setProductCatalogKey] = useStateR("weight-loss");
  const [query, setQuery] = useStateR("");
  const [products, setProducts] = useStateR([]);
  const [selectedProduct, setSelectedProduct] = useStateR(null);
  const [quantity, setQuantity] = useStateR(1);
  const [instructions, setInstructions] = useStateR("");
  const [cart, setCart] = useStateR([]);
  const [patientsLoading, setPatientsLoading] = useStateR(true);
  const [productsLoading, setProductsLoading] = useStateR(false);
  const [needlesProduct, setNeedlesProduct] = useStateR(null);
  const [autoNeedlesDismissed, setAutoNeedlesDismissed] = useStateR(false);
  const [publishing, setPublishing] = useStateR(false);
  const [error, setError] = useStateR("");
  const [sentToast, setSentToast] = useStateR("");
  const quickWlpDoctorId = initialQuickWlpDoctorId || DOCTOR_ID;

  const quickWlpPatient = useMemoR(() => {
    if (!isQuickWlpMode) return null;
    const name = initialQuickWlpName || "Quick WLP customer";
    const phone = initialQuickWlpPhone || initialQuickWlpWhatsapp || "";
    return {
      key: `quickwlp:${initialQuickWlpLeadId}`,
      id: initialQuickWlpLeadId,
      customerId: "",
      name,
      initials: patientInitials(name),
      age: null,
      sex: "",
      phone,
      email: initialQuickWlpEmail || "",
      whatsapp: initialQuickWlpWhatsapp || "",
      trackKey: "weight-loss",
      doctorId: quickWlpDoctorId,
      subscriptionStatus: "Quick WLP",
      latestCompletedAt: null,
      canPrescribe: true,
    };
  }, [initialQuickWlpEmail, initialQuickWlpLeadId, initialQuickWlpName, initialQuickWlpPhone, initialQuickWlpWhatsapp, isQuickWlpMode, quickWlpDoctorId]);

  const rxPatient = patients.find((item) => item.key === selectedPatientKey) || null;
  const patient = isQuickWlpMode ? quickWlpPatient : rxPatient;
  const activeTrack = TRACKS.find((track) => track.key === trackKey) || TRACKS[0];
  const activeProductCatalog = productCatalogKey === SUPPLEMENTS_CATALOG.key
    ? SUPPLEMENTS_CATALOG
    : TRACKS.find((track) => track.key === productCatalogKey) || activeTrack;
  const productCatalogs = isQuickWlpMode ? [...TRACKS, SUPPLEMENTS_CATALOG] : [activeTrack, SUPPLEMENTS_CATALOG];
  const canPublish = Boolean(cart.length && !publishing && patient && (isQuickWlpMode || patient.customerId));

  const loadPatients = React.useCallback(async () => {
    if (isQuickWlpMode) {
      setPatients([]);
      setPatientsLoading(false);
      setError("");
      return;
    }
    setPatientsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        doctor_id: DOCTOR_ID,
        limit: "100",
        offset: "0",
      });
      if (patientTrackFilter !== ALL_TRACK) params.set("track_key", patientTrackFilter);
      if (patientQuery.trim()) params.set("q", patientQuery.trim());
      const data = await fetchJson(`${API_BASE}/doctor/rx/prescribable-patients?${params.toString()}`);
      const nextPatients = (data.patients || []).map(mapPrescribablePatient);
      setPatients(nextPatients);
      setSelectedPatientKey((current) => {
        const deepLinked = initialPatientId
          ? nextPatients.find((item) => item.id === initialPatientId && (!initialTrackKey || item.trackKey === initialTrackKey))
            || nextPatients.find((item) => item.id === initialPatientId)
          : initialCustomerId
            ? nextPatients.find((item) => item.customerId === initialCustomerId && (!initialTrackKey || item.trackKey === initialTrackKey))
              || nextPatients.find((item) => item.customerId === initialCustomerId)
          : null;
        if (deepLinked) return deepLinked.key;
        if (current && nextPatients.some((item) => item.key === current)) return current;
        return "";
      });
    } catch (err) {
      setError(errorCopy(err.message, err.payload) || "Could not load prescribable patients.");
    } finally {
      setPatientsLoading(false);
    }
  }, [initialCustomerId, initialPatientId, initialTrackKey, isQuickWlpMode, patientQuery, patientTrackFilter]);

  useEffectR(() => {
    loadPatients();
  }, [loadPatients]);

  useEffectR(() => {
    if (!isQuickWlpMode && !initialPatientId && !initialCustomerId) setSelectedPatientKey("");
  }, [initialCustomerId, initialPatientId, isQuickWlpMode]);

  useEffectR(() => {
    if (!patient) return;
    setTrackKey(patient.trackKey);
    setProductCatalogKey(patient.trackKey);
    setCart([]);
    setAutoNeedlesDismissed(false);
    setSelectedProduct(null);
    setInstructions("");
    setQuery("");
  }, [patient?.key]);

  useEffectR(() => {
    let cancelled = false;
    const loadProducts = async () => {
      setProductsLoading(true);
      setError("");
      try {
        if (isQuickWlpMode) {
          const params = new URLSearchParams({
            doctor_id: patient.doctorId || quickWlpDoctorId,
            seller_id: SUPPLEMENT_SELLER_ID,
            catalog: productCatalogKey,
            limit: "100",
            offset: "0",
          });
          if (query.trim()) params.set("q", query.trim());
          const data = await fetchJson(`${API_BASE}/doctor/quickwlp/products?${params.toString()}`);
          if (!cancelled) setProducts(data.products || []);
        } else if (productCatalogKey === SUPPLEMENTS_CATALOG.key) {
          const params = new URLSearchParams({
            seller_id: SUPPLEMENT_SELLER_ID,
            product_type: "SKU",
            category: "SUPPLEMENT",
            view: "full",
            limit: "100",
            offset: "0",
          });
          if (query.trim()) params.set("q", query.trim());
          const data = await fetchJson(`${API_BASE}/verticals/shipments/products?${params.toString()}`);
          if (!cancelled) setProducts((data.products || []).map(mapSupplementProduct));
        } else {
          const params = new URLSearchParams({
            doctor_id: DOCTOR_ID,
            limit: "100",
            offset: "0",
          });
          if (query.trim()) params.set("q", query.trim());
          const data = await fetchJson(`${API_BASE}/doctor/rx/tracks/${productCatalogKey}/prescribable-products?${params.toString()}`);
          if (!cancelled) setProducts(data.products || []);
        }
      } catch (err) {
        if (!cancelled) {
          setProducts([]);
          setError(errorCopy(err.message, err.payload) || "Could not load prescribable products.");
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
  }, [isQuickWlpMode, patient, productCatalogKey, query, quickWlpDoctorId]);

  const visibleProducts = useMemoR(() => {
    return products
      .map((product) => ({ ...product, details: productDetails(product, productCatalogKey) }));
  }, [products, productCatalogKey]);

  const cartTotal = cart.reduce((sum, item) => sum + ((item.price_fils || 0) * item.quantity), 0);

  const chooseTrack = (nextTrack) => {
    setPatientTrackFilter(nextTrack);
    setSelectedPatientKey("");
    setCart([]);
    setAutoNeedlesDismissed(false);
    setSelectedProduct(null);
    setInstructions("");
  };

  const chooseProductCatalog = (nextCatalogKey) => {
    setProductCatalogKey(nextCatalogKey);
    setSelectedProduct(null);
    setInstructions("");
    setQuery("");
  };

  const pickProduct = (product) => {
    if (isOutOfStock(product, productCatalogKey)) {
      setError(`${product.name} is out of stock.`);
      return;
    }
    setSelectedProduct(product);
    setQuantity(Math.min(1, Math.max(1, productQuantityLimit(product, productCatalogKey))));
    setInstructions(product.details.instructions);
  };

  useEffectR(() => {
    if (!selectedProduct) return;
    const limit = productQuantityLimit(selectedProduct, productCatalogKey);
    if (limit > 0 && quantity > limit) setQuantity(limit);
  }, [productCatalogKey, quantity, selectedProduct]);

  const loadNeedlesProduct = React.useCallback(async () => {
    if (needlesProduct) return needlesProduct;
    const params = new URLSearchParams({
      seller_id: SUPPLEMENT_SELLER_ID,
      view: "full",
    });
    const data = await fetchJson(`${API_BASE}/verticals/shipments/products/${encodeURIComponent(NEEDLES_PRODUCT_ID)}?${params.toString()}`);
    const mapped = mapShipmentProduct({ ...data.product, seller_offer: data.seller_offer });
    const productWithDetails = {
      ...mapped,
      details: productDetails(mapped, NEEDLES_CATALOG.key),
    };
    setNeedlesProduct(productWithDetails);
    return productWithDetails;
  }, [needlesProduct]);

  const addToCart = async () => {
    if (!selectedProduct) return;
    const quantityLimit = productQuantityLimit(selectedProduct, productCatalogKey);
    if (quantityLimit <= 0) {
      setError(`${selectedProduct.name} is out of stock.`);
      return;
    }
    if (quantity > quantityLimit) {
      setError(`Only ${quantityLimit} ${quantityLimit === 1 ? "unit is" : "units are"} available for ${selectedProduct.name}.`);
      return;
    }
    let nextNeedlesProduct = needlesProduct;
    if (isMounjaroProduct(selectedProduct) && !autoNeedlesDismissed && !nextNeedlesProduct) {
      try {
        nextNeedlesProduct = await loadNeedlesProduct();
      } catch {
        setError("Could not load the needles product.");
        return;
      }
    }
    const item = {
      id: `${productCatalogKey}:${selectedProduct.product_id}`,
      product_id: selectedProduct.product_id,
      vertical_id: selectedProduct.vertical_id,
      name: selectedProduct.name,
      price_fils: selectedProduct.price_fils,
      quantity,
      doctor_instructions: instructions.trim() || selectedProduct.details.instructions,
      details: selectedProduct.details,
      catalogKey: productCatalogKey,
    };
    setCart((current) => {
      const withoutCurrent = current.filter((entry) => entry.id !== item.id);
      return syncAutoNeedles([...withoutCurrent, item], nextNeedlesProduct, autoNeedlesDismissed);
    });
    setSelectedProduct(null);
    setInstructions("");
    setQuery("");
  };

  const removeCart = (id) => {
    if (id === AUTO_NEEDLES_CART_ID) {
      setAutoNeedlesDismissed(true);
      setCart((current) => current.filter((item) => item.id !== id));
      return;
    }

    setCart((current) => {
      const nextItems = current.filter((item) => item.id !== id);
      const hasMounjaro = requiredNeedlesQuantity(nextItems) > 0;
      if (!hasMounjaro && autoNeedlesDismissed) setAutoNeedlesDismissed(false);
      return syncAutoNeedles(nextItems, needlesProduct, hasMounjaro ? autoNeedlesDismissed : false);
    });
  };

  const publishPrescription = async () => {
    if (!patient || !cart.length) return;
    setPublishing(true);
    setError("");
    setSentToast("");
    try {
      const items = cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        doctor_instructions: item.doctor_instructions,
      }));
      const endpoint = isQuickWlpMode
        ? `${API_BASE}/doctor/quickwlp/requests/${encodeURIComponent(patient.id)}/prescriptions`
        : initialRefillRequestId
          ? `${API_BASE}/doctor/rx/refill-requests/${encodeURIComponent(initialRefillRequestId)}/prescriptions`
          : `${API_BASE}/doctor/patients/${patient.id}/rx/tracks/${trackKey}/prescriptions`;
      const payload = isQuickWlpMode
        ? {
          doctor_id: patient.doctorId || quickWlpDoctorId,
          seller_id: SUPPLEMENT_SELLER_ID,
          items,
        }
        : {
          doctor_id: DOCTOR_ID,
          customer_id: patient.customerId,
          title: `${activeTrack.label} Rx plan`,
          summary: activeTrack.summary,
          items,
        };
      const data = await fetchJson(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setCart([]);
      setAutoNeedlesDismissed(false);
      setSelectedProduct(null);
      const quickWlpExpiry = formatDateTime(data.prescription?.checkout_expires_at);
      setSentToast(
        isQuickWlpMode
          ? quickWlpExpiry
            ? `Checkout link sent · expires ${quickWlpExpiry}`
            : "Checkout link sent to customer"
          : data.care_plan?.title || `${activeTrack.label} care plan published`
      );
      setTimeout(() => setSentToast(""), 2600);
      if (!isQuickWlpMode) await loadPatients();
      if (onSent) onSent();
    } catch (err) {
      setError(errorCopy(err.message, err.payload));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <Topbar
        title={isQuickWlpMode ? "Prescribe Quick WLP" : initialRefillRequestId ? "Prescribe refill" : "Prescribe"}
        subtitle={isQuickWlpMode ? "Create a checkout intent and send it to the customer" : patientsLoading ? "Loading eligible patients" : "Select a completed consultation, then publish an Rx care plan"}
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
                      {isQuickWlpMode
                        ? [patient.phone, patient.email, "Quick WLP"].filter(Boolean).join(" · ")
                        : [patient.age, patient.sex, activeTrack.label, `Completed ${formatDateTime(patient.latestCompletedAt)}`].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  {!isQuickWlpMode && <button className="btn-ghost rx-change-patient" onClick={() => setSelectedPatientKey("")}>Change patient</button>}
                </div>

                <div className="section-hdr"><div className="label">Prescribable products</div></div>
                <div className="rx-track-tabs rx-product-source-tabs">
                  {productCatalogs.map((catalog) => (
                    <button
                      key={catalog.key}
                      className={productCatalogKey === catalog.key ? "active" : ""}
                      onClick={() => chooseProductCatalog(catalog.key)}
                    >
                      {catalog.label}
                    </button>
                  ))}
                </div>
                <div className="rx-search">
                  <span className="rx-search-icon">{I.search}</span>
                  <input
                    className="rx-search-input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={`Search ${activeProductCatalog.label.toLowerCase()} products`}
                  />
                </div>

                <div className="rx-product-list">
                  {productsLoading ? (
                    <div className="patient-loading"><div /><div /><div /></div>
                  ) : visibleProducts.length ? visibleProducts.map((product) => {
                    const stockLabel = productStockLabel(product, productCatalogKey);
                    const outOfStock = isOutOfStock(product, productCatalogKey);
                    return (
                      <button
                        key={product.product_id}
                        className={`rx-product-row${outOfStock ? " out-of-stock" : ""}`}
                        onClick={() => pickProduct(product)}
                        disabled={outOfStock}
                      >
                        <div>
                          <div className="nm">{product.name}</div>
                          <div className="ds">
                            {[product.details.strength, product.details.frequency, product.details.packSize, stockLabel].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div className="rx-product-price">{outOfStock ? "Out of stock" : product.details.price}</div>
                      </button>
                    );
                  }) : (
                    <div className="empty-state rx-product-empty">No products found in this catalog.</div>
                  )}
                </div>
              </>
            )}
          </div>

          {patient && selectedProduct && (
            <div className="rx-selection-tray fade-in" key={selectedProduct.product_id}>
              {(() => {
                const quantityLimit = productQuantityLimit(selectedProduct, productCatalogKey);
                const stockLabel = productStockLabel(selectedProduct, productCatalogKey);
                const blocked = quantityLimit <= 0;
                return (
                  <>
              <div className="rx-selection-head">
                <div>
                  <div className="rx-selection-title">{selectedProduct.name}</div>
                  <div className="rx-selection-meta">
                    {[selectedProduct.details.price, selectedProduct.details.category, stockLabel].filter(Boolean).join(" · ")}
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
                      onClick={() => setQuantity((current) => Math.min(quantityLimit, current + 1))}
                      disabled={blocked || quantity >= quantityLimit}
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
                {blocked ? "This supplement is out of stock." : selectedProduct.details.instructions}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button className="btn-ghost" onClick={() => setSelectedProduct(null)}>Cancel</button>
                <button className="btn-primary" onClick={addToCart} disabled={blocked}>{I.plus}<span>Add to plan</span></button>
              </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <div className="rx-side dd-scroll">
          <div className="section-hdr"><div className="label">Care plan</div></div>
          <div className="rx-cart">
            {!patient ? (
              <div className="empty">{isQuickWlpMode ? "Quick WLP request not found." : "Choose a patient with a completed consultation to begin."}</div>
            ) : cart.length === 0 ? (
              <div className="empty">No products added yet.<br/>Select catalog products to build the plan.</div>
            ) : cart.map((item) => (
              <div key={item.id} className="rx-cart-item">
                <span className="x" onClick={() => removeCart(item.id)}>{I.x}</span>
                <div className="nm">{item.name}</div>
                <div className="ds">
                  {item.autoAdded
                    ? "Auto-added needles"
                    : item.catalogKey === SUPPLEMENTS_CATALOG.key ? "Supplements" : TRACKS.find((track) => track.key === item.catalogKey)?.label || activeTrack.label} · Qty {item.quantity} · {formatPrice((item.price_fils || 0) * item.quantity)}
                </div>
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
              disabled={!canPublish}
              style={{ opacity: canPublish ? 1 : 0.4, cursor: canPublish ? "pointer" : "not-allowed" }}
              onClick={publishPrescription}
            >
              {publishing ? "Sending..." : isQuickWlpMode ? "Create and send checkout" : "Publish care plan"}
            </button>
          </div>

          {patient && (
            <>
              <h4 style={{ font: "400 11px/1 var(--dd-font)", textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--dd-text-tertiary)", margin: "28px 0 12px" }}>{isQuickWlpMode ? "Customer" : "Eligibility"}</h4>
              <div className="kv-row"><div className="k">Track</div><div className="v">{isQuickWlpMode ? "Quick WLP" : activeTrack.label}</div></div>
              {isQuickWlpMode ? (
                <>
                  <div className="kv-row"><div className="k">Phone</div><div className="v">{patient.phone || "Not provided"}</div></div>
                  <div className="kv-row"><div className="k">Email</div><div className="v">{patient.email || "Not provided"}</div></div>
                </>
              ) : (
                <>
                  <div className="kv-row"><div className="k">Subscription</div><div className="v">{titleCase(patient.subscriptionStatus)}</div></div>
                  <div className="kv-row"><div className="k">Completed</div><div className="v">{formatDateTime(patient.latestCompletedAt)}</div></div>
                </>
              )}
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
