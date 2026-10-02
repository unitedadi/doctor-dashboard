import * as React from "react";

function historyDate(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(date)
    : "Not recorded";
}

function recordLabel(value) {
  return String(value || "").toLowerCase().replace(/_/g, " ").replace(/^./, letter => letter.toUpperCase());
}

function MedicationItems({ items }) {
  return <ul className="refill-medications">{(items || []).map((item, index) => (
    <li key={`${item.product_id || "item"}-${index}`}>
      <div className="refill-medication-line">
        <strong>{item.name || "Medication name not recorded"}</strong>
        {item.quantity ? <span>Qty {item.quantity}</span> : null}
      </div>
      {item.doctor_instructions ? <p className="refill-record-copy">{item.doctor_instructions}</p> : null}
    </li>
  ))}</ul>;
}

export default function RefillMedicationContext({ context }) {
  const purchase = context?.previous_purchase;
  const prescription = context?.prior_prescription;
  const plans = context?.care_plans || [];
  const hasHistory = Boolean(prescription || plans.length);
  return (
    <section className="refill-treatment" aria-label="Previous treatment history">
      <header className="refill-treatment-heading">
        <h3>Previous treatment</h3>
        <span className="refill-history-badge">Historical record</span>
      </header>
      {purchase ? <>
        <MedicationItems items={purchase.items} />
        <dl className="refill-supply-facts">
          <div><dt>Delivered</dt><dd>{historyDate(purchase.delivered_at)}</dd></div>
          <div><dt>Paid</dt><dd>{historyDate(purchase.paid_at)}</dd></div>
          <div><dt>Order</dt><dd>{purchase.order_id}</dd></div>
        </dl>
      </> : <>
        {hasHistory ? <MedicationItems items={prescription?.items || plans[0]?.items} /> : null}
        <p className="refill-record-copy">Previous purchase details are unavailable.</p>
      </>}
      <p className="refill-history-caution">{purchase ? "Past supply" : "Historical treatment"}, not confirmation of current use. Confirm the patient’s current medication and dose before prescribing.</p>
      {hasHistory ? <details className="refill-history-details">
        <summary>
          <span>View previous prescription &amp; notes</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </summary>
        <div className="refill-history-records">
          {prescription ? <section className="refill-history-record">
            <h4>Prescription {prescription.rx_number || prescription.prescription_id}</h4>
            <p className="refill-record-meta">{prescription.doctor_name || "Doctor not recorded"} · {historyDate(prescription.issued_at)} · {recordLabel(prescription.status)}</p>
            <MedicationItems items={prescription.items} />
          </section> : null}
          {plans.map(plan => <section className="refill-history-record" key={plan.care_plan_id}>
            <h4>{plan.title}</h4>
            <p className="refill-record-meta">{plan.doctor_name || "Doctor not recorded"} · {historyDate(plan.published_at)} · {recordLabel(plan.status)}</p>
            {plan.summary ? <p className="refill-record-copy">{plan.summary}</p> : null}
            <MedicationItems items={plan.items} />
            {plan.consultation ? <div className="refill-consultation-note">
              <h5>Consultation notes</h5>
              <p className="refill-record-meta">{recordLabel(plan.consultation.status)} · {historyDate(plan.consultation.completed_at)}{plan.consultation.outcome ? ` · ${recordLabel(plan.consultation.outcome)}` : ""}</p>
              <p className="refill-record-copy">{plan.consultation.note || "Notes not recorded."}</p>
            </div> : null}
          </section>)}
        </div>
      </details> : <div className="refill-history-missing" role="note">
        <strong>Clinical history unavailable</strong>
        <p>Review with the patient; a purchase alone is not a prescription.</p>
      </div>}
    </section>
  );
}
