// Preserve the public supplement offers/stock; add only the doctor-approved GS1 SKU.
export const DOCTOR_GS1_PRODUCT_ID = "SKIN-SKU-DEC-GS1";

export async function loadDoctorSupplementProducts({ fetchJson, apiBase, doctorId, sellerId, query = "" }) {
  const publicParams = new URLSearchParams({ seller_id: sellerId, product_type: "SKU", category: "SUPPLEMENT", view: "full", limit: "100", offset: "0" });
  if (query.trim()) publicParams.set("q", query.trim());
  const doctorParams = new URLSearchParams({ doctor_id: doctorId, seller_id: sellerId, catalog: "supplements", q: query.trim() || DOCTOR_GS1_PRODUCT_ID, limit: "100", offset: "0" });
  const [ordinary, approved] = await Promise.all([
    fetchJson(`${apiBase}/verticals/shipments/products?${publicParams}`),
    fetchJson(`${apiBase}/doctor/quickwlp/products?${doctorParams}`),
  ]);
  const products = new Map((ordinary.products || []).map(product => [product.product_uuid || product.product_id, product]));
  for (const product of approved.products || []) {
    if (product.product_id === DOCTOR_GS1_PRODUCT_ID && !products.has(product.product_id)) products.set(product.product_id, product);
  }
  return [...products.values()];
}
