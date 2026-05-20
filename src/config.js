export const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "/api" : "");
export const DOCTOR_ID = import.meta.env.VITE_DOCTOR_ID || "doctor_sami_dev";

if (!API_BASE) {
  console.error("Missing VITE_API_BASE. Set it in Vercel Environment Variables for production.");
}
