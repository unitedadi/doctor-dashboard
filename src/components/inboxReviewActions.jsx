import { useRef, useState } from 'react';
import { API_BASE, DOCTOR_ID } from '../config.js';
import { authFetch, fetchJson } from '../lib/authFetch.js';

export default function InboxReviewActions({ task, onResolved }) {
  const [note, setNote] = useState('');
  const [prescriptionId, setPrescriptionId] = useState(task.raw?.related_prescriptions?.length === 1 ? task.raw.related_prescriptions[0].prescription_id : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requestStatus, setRequestStatus] = useState(null);
  const requestingIntake = useRef(false);
  const intakeStatus = ['DELIVERED', 'READ'].includes(task.raw?.intake_whatsapp_status)
    ? task.raw.intake_whatsapp_status : requestStatus || task.raw?.intake_whatsapp_status;
  const evidence = task.raw?.related_prescriptions || [];
  const purchase = task.category === 'purchase_review';
  const intake = task.category === 'purchase_intake';
  if (!purchase && !intake && !evidence.length) return task.raw?.record_issue ? <section className="clinical-detail-section"><h3>Patient record verification needed</h3><p>The care team must verify the member identity and link the existing records. A prescription on the same account may belong to another person. Do not issue a duplicate to clear this entry.</p></section> : null;
  const requestIntake = async () => {
    if (requestingIntake.current || intakeStatus || !task.raw?.intake_whatsapp_enabled) return;
    requestingIntake.current = true;
    setBusy(true); setError('');
    try {
      const result = await fetchJson(`${API_BASE}/doctor/purchase-reviews/${encodeURIComponent(task.orderId)}/request-intake`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: DOCTOR_ID, version: task.raw.review_version })
      });
      setRequestStatus(result.status || 'CHECK_REQUIRED');
    } catch (err) {
      const messages = {
        intake_customer_phone_missing: 'The paid order has no valid contact number. Ask CX to verify it.',
        intake_whatsapp_unavailable: 'WhatsApp requests are not available yet. Ask CX to help the customer.',
        purchase_review_changed: 'This order has changed. Refresh the inbox before continuing.',
        purchase_intake_unavailable: 'Intake may already be complete. Refresh the inbox.',
        purchase_review_unavailable: 'This order is no longer available for review. Refresh the inbox.'
      };
      setError(messages[err.message] || 'Could not confirm the request. Refresh the inbox to check its saved status before trying again.');
      if (!messages[err.message]) setRequestStatus('CHECK_REQUIRED');
    } finally { requestingIntake.current = false; setBusy(false); }
  };
  const openDocument = async () => {
    setError('');
    try {
      const response = await authFetch(`${API_BASE}/doctor/purchase-reviews/${encodeURIComponent(task.orderId)}/document?doctor_id=${encodeURIComponent(DOCTOR_ID)}`);
      if (!response.ok) throw new Error('Could not open the prescription');
      const url = URL.createObjectURL(await response.blob());
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { setError(err.message); }
  };
  const approve = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await fetchJson(`${API_BASE}/doctor/purchase-reviews/${encodeURIComponent(task.orderId)}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctor_id: DOCTOR_ID, version: task.raw.review_version })
      });
      onResolved?.(task.id);
    } catch (err) {
      const messages = {
        order_already_has_prescription: 'This order already has a prescription. Refreshing the inbox.',
        purchase_review_changed: 'This review changed. Refresh the inbox before trying again.',
        patient_profile_incomplete: 'Patient details are incomplete. Open the chart and complete the required patient details before approving.'
      };
      setError(messages[err.message] || err.message);
      if (err.message === 'order_already_has_prescription') onResolved?.(task.id);
    }
    finally { setBusy(false); }
  };
  const submit = async event => {
    event.preventDefault();
    if (!prescriptionId || busy) return;
    setBusy(true); setError('');
    try {
      const path = `/doctor/appointments/${encodeURIComponent(task.appointmentId)}/resolve-prescription`;
      await fetchJson(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        doctor_id: DOCTOR_ID, note: note.trim() || 'Doctor reviewed the existing prescription and confirmed it covers this consultation; no additional prescription is needed.', prescription_id: prescriptionId
      }) });
      onResolved?.(task.id);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="clinical-detail-section inbox-review-form">
    <h3>{intake ? 'Complete patient intake' : purchase ? 'Purchased medication' : 'Later prescription found'}</h3>
    {(purchase || intake) && <p><strong>Order {task.orderId}</strong> · {task.raw.doctor_id ? 'Assigned to your care' : 'Shared review queue'}</p>}
    {(purchase || intake) && <p>Paid on {new Date(task.occurredAt).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' })}. This is the original payment date, not a new request.</p>}
    {(purchase || intake) && <ul>{(task.raw.items || []).map((item, index) => <li key={index}>{item.name}{item.quantity != null ? ` · Quantity: ${item.quantity}` : ''}</li>)}</ul>}
    {intake ? <>
      <p>Request the missing details on WhatsApp. The customer returns to this paid order—no new booking or payment. Once submitted, it moves to prescription review.</p>
      {error && <p role="alert">{error}</p>}
      {intakeStatus ? <p role="status">{intakeStatus === 'READ' ? 'WhatsApp delivered · Read' : intakeStatus === 'DELIVERED' ? 'WhatsApp delivered' : intakeStatus === 'SENT' ? 'WhatsApp sent · Delivery not yet confirmed' : 'Request needs checking. Ask CX to check WhatsApp before sending again.'}</p> : <>
        <button type="button" className="clinical-primary-action" disabled={busy || !task.raw?.intake_whatsapp_enabled} onClick={requestIntake}>{busy ? 'Sending…' : 'Request details on WhatsApp'}</button>
        {!task.raw?.intake_whatsapp_enabled && <p>WhatsApp requests are not available yet. Ask CX to help the customer complete their existing purchase confirmation page.</p>}
      </>}
    </> : purchase ? <>
      <p>Review the purchased medication and patient before approving. Approve creates the prescription against this paid order; it does not take another payment.</p>
      {task.raw.delivered_at && <p role="note">This order was already delivered. Check its existing prescription records first; do not create a duplicate simply to clear this task.</p>}
      {task.raw.has_document && <button type="button" className="clinical-secondary-action" onClick={openDocument}>View uploaded prescription</button>}
      {error && <p role="alert">{error}</p>}
      <button className="clinical-primary-action" type="button" disabled={busy} onClick={approve}>{busy ? 'Approving…' : 'Approve'}</button>
    </> : <form onSubmit={submit}>
        <p>This visit is still open. Confirm whether a later prescription covers its medication decision.</p>
        <label>Prescription covering this visit<select value={prescriptionId} onChange={e => setPrescriptionId(e.target.value)} required>
          <option value="">Select a prescription</option>
          {evidence.map(p => <option key={p.prescription_id} value={p.prescription_id}>{p.rx_number || p.prescription_id} · {p.patient_name_snapshot} · {new Date(p.issued_at).toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' })}</option>)}
        </select></label>
        <ul>{evidence.filter(p => p.prescription_id === prescriptionId).flatMap(p => p.items_json || []).map((item, index) => <li key={index}>{item.name || item.product_id}</li>)}</ul>
      <details><summary>Add a clinical note (optional)</summary><label>Clinical note<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={2000} rows={3} /></label></details>
      <p>Confirm only if this prescription covers the selected visit and no additional prescription is needed. This records your decision and clears this visit.</p>
      {error && <p role="alert">{error}</p>}
      <button className="clinical-primary-action" type="submit" disabled={busy || !prescriptionId}>{busy ? 'Saving…' : 'Confirm and clear this visit'}</button>
    </form>}
  </section>;
}
