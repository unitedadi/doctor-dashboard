function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizePhoneDigits(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("9710")) digits = `971${digits.slice(4)}`;
  if (digits.startsWith("0")) digits = `971${digits.slice(1)}`;
  return digits;
}

function phoneVariants(value) {
  const raw = String(value || "").replace(/\D/g, "");
  const normalized = normalizePhoneDigits(value);
  const local = normalized.startsWith("971") ? `0${normalized.slice(3)}` : normalized;
  return [...new Set([raw, normalized, local].filter(Boolean))];
}

export function patientMatchesSearch(patient, rawQuery) {
  const query = normalizeText(rawQuery);
  if (!query) return true;

  const text = [patient?.name, patient?.phone, patient?.email, patient?.city]
    .filter(Boolean)
    .map(normalizeText)
    .join(" ");
  if (text.includes(query)) return true;

  if (!/^[+\d\s()-]+$/.test(query)) return false;
  const patientPhoneVariants = phoneVariants(patient?.phone);
  const queryPhoneVariants = phoneVariants(query);
  return patientPhoneVariants.some((phone) => queryPhoneVariants.some((candidate) => phone.includes(candidate)));
}
