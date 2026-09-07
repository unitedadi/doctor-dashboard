export function prescriptionAmendmentContext(patient, prescription, doctorId) {
  const trackKey = prescription.track_key || prescription.trackKey || patient.track_key || patient.trackKey || "";
  const context = {
    amendSource: prescription.source,
    amendId: prescription.id || prescription.prescription_id || "",
    amendItems: JSON.stringify(Array.isArray(prescription.items) ? prescription.items : []),
    patientId: patient.id || "",
    customerId: patient.customerId || patient.customer_id || "",
    patientName: patient.name || "",
    patientPhone: patient.phone || "",
    trackKey,
    prescriptionMode: "reissue",
  };
  if (prescription.source === "quickwlp_prescription") {
    Object.assign(context, {
      quickWlpLeadId: prescription.quickWlpLeadId || prescription.lead_id || "",
      quickWlpTrackKey: trackKey,
      quickWlpSellerId: prescription.seller_id || "",
      quickWlpSellerName: prescription.seller_name || "",
      quickWlpPromoCode: prescription.b2b_promo_code || "",
      quickWlpName: patient.name || "",
      quickWlpPhone: patient.phone || "",
      quickWlpEmail: patient.email || "",
      quickWlpDoctorId: doctorId,
    });
  }
  return context;
}
