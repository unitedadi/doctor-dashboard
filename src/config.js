export const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "/api" : "");
export const CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  "";
export const DEFAULT_DOCTOR_ACCOUNT_ID = import.meta.env.VITE_DEFAULT_DOCTOR_ACCOUNT_ID || "mp_sami";
export const SUPPLEMENT_SELLER_ID = import.meta.env.VITE_SUPPLEMENT_SELLER_ID || "seller_655656ac86b8";
export const NEEDLES_PRODUCT_ID = import.meta.env.VITE_NEEDLES_PRODUCT_ID || "product_76351c184fac";

export const DOCTOR_ACCOUNTS = {
  mp_sami: {
    accountId: "mp_sami",
    doctorId: import.meta.env.VITE_DOCTOR_ID || "doctor_sami_dev",
    profile: {
      name: "Dr. Sami",
      title: "GLP-1 & Peptide Specialist",
      initials: "S",
      license: "MOH-DXB-29871",
    },
  },
  mp_marwa: {
    accountId: "mp_marwa",
    doctorId: "doctor_marwa",
    profile: {
      name: "Dr. Marwa",
      title: "Quick WLP Physician",
      initials: "M",
      license: "",
    },
  },
};

const DOCTOR_ACCOUNT_EMAILS = {
  "dr.sami@dardoc.com": "mp_sami",
  "sami@dardoc.com": "mp_sami",
  "aditya.yadav@dardoc.com": "mp_sami",
  "dr.marwa@dardoc.com": "mp_marwa",
};

function normalizeDoctorAccountId(accountId) {
  const normalized = String(accountId || "").trim().toLowerCase();
  return DOCTOR_ACCOUNTS[normalized] ? normalized : DEFAULT_DOCTOR_ACCOUNT_ID;
}

function normalizeDoctorAccountOverride(accountId) {
  const normalized = String(accountId || "").trim().toLowerCase();
  return DOCTOR_ACCOUNTS[normalized] ? normalized : "";
}

export let ACTIVE_DOCTOR_ACCOUNT_ID = normalizeDoctorAccountId(DEFAULT_DOCTOR_ACCOUNT_ID);
export let DOCTOR_ID = DOCTOR_ACCOUNTS[ACTIVE_DOCTOR_ACCOUNT_ID].doctorId;

function applyDoctorProfile(account) {
  if (typeof window === "undefined" || !window.DD_DATA) return;
  window.DD_DATA.DOCTOR = {
    ...(window.DD_DATA.DOCTOR || {}),
    ...account.profile,
    accountId: account.accountId,
    doctorId: account.doctorId,
  };
}

export function setActiveDoctorAccount(accountId) {
  ACTIVE_DOCTOR_ACCOUNT_ID = normalizeDoctorAccountId(accountId);
  const account = DOCTOR_ACCOUNTS[ACTIVE_DOCTOR_ACCOUNT_ID];
  DOCTOR_ID = account.doctorId;
  applyDoctorProfile(account);
  return account;
}

export function getActiveDoctorAccount() {
  return DOCTOR_ACCOUNTS[ACTIVE_DOCTOR_ACCOUNT_ID];
}

export function resolveDoctorAccountFromLocation(location = window.location) {
  const params = new URLSearchParams(location.search);
  return normalizeDoctorAccountOverride(params.get("account_id") || params.get("doctor_account_id"));
}

export function resolveDoctorAccountFromEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return DOCTOR_ACCOUNT_EMAILS[normalized] || "";
}

if (!API_BASE) {
  console.error("Missing VITE_API_BASE. Set it in Vercel Environment Variables for production.");
}
