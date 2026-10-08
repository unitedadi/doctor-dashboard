import { useState } from 'react';
import { API_BASE, DOCTOR_ID } from '../config.js';
import { authFetch, fetchJson } from '../lib/authFetch.js';

export default function InboxReviewActions({ task, onResolved }) {
  const [note, setNote] = useState('');
  const [prescriptionId, setPrescriptionId] = useState(task.raw?.related_prescriptions?.length === 1 ? task.raw.related_prescriptions[0].prescription_id : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const evidence = task.raw?.related_prescriptions || [];
  const purchase = task.category === 'purchase_review';
  const intake = task.category === 'purchase_intake';
  if (!purchase && !intake && !evidence.length) return task.raw?.record_issue ? <section className="clinical-detail-section"><h3>Patient record verification needed</h3><p>The care team must verify the member identity and link the existing records. A prescription on the same account may belong to another person. Do not issue a duplicate to clear this entry.</p></section> : null;
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
    {intake ? <p>Ask the care team to help the customer complete the patient details on their purchase confirmation page. This order will move to prescription review once intake is submitted.</p> : purchase ? <>
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
