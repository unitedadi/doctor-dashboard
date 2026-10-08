import { useState } from 'react';
import { API_BASE, DOCTOR_ID } from '../config.js';
import { authFetch, fetchJson } from '../lib/authFetch.js';

export default function InboxReviewActions({ task, onResolved }) {
  const [note, setNote] = useState('');
  const [prescriptionId, setPrescriptionId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const evidence = task.raw?.related_prescriptions || [];
  const purchase = task.category === 'purchase_review';
  const intake = task.category === 'purchase_intake';
  if (!purchase && !intake && !evidence.length) return null;
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
      onResolved?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const submit = async event => {
    event.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true); setError('');
    try {
      const path = `/doctor/appointments/${encodeURIComponent(task.appointmentId)}/resolve-prescription`;
      await fetchJson(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        doctor_id: DOCTOR_ID, note, prescription_id: prescriptionId
      }) });
      onResolved?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="clinical-detail-section inbox-review-form">
    <h3>{intake ? 'Complete patient intake' : purchase ? 'Purchased medication' : 'Later prescription found'}</h3>
    {(purchase || intake) && <p><strong>Order {task.orderId}</strong> · {task.raw.doctor_id ? 'Assigned to your care' : 'Shared review queue'}</p>}
    {(purchase || intake) && <ul>{(task.raw.items || []).map((item, index) => <li key={index}>{item.name}{item.quantity != null ? ` · Quantity: ${item.quantity}` : ''}</li>)}</ul>}
    {intake ? <p>Ask the care team to help the customer complete the patient details on their purchase confirmation page. This order will move to prescription review once intake is submitted.</p> : purchase ? <>
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
      <label>Clinical note<textarea value={note} onChange={e => setNote(e.target.value)} required maxLength={2000} rows={3} /></label>
      <label className="inbox-review-confirm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} required />I confirm this prescription covers this consultation and no additional prescription is needed.</label>
      {error && <p role="alert">{error}</p>}
      <button className="clinical-primary-action" type="submit" disabled={busy || !confirmed || !note.trim() || !prescriptionId}>{busy ? 'Saving…' : 'Resolve this consultation'}</button>
    </form>}
  </section>;
}
