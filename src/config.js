export const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "/api" : "");
export const DOCTOR_ID = import.meta.env.VITE_DOCTOR_ID || "doctor_sami_dev";
export const SUPPLEMENT_SELLER_ID = import.meta.env.VITE_SUPPLEMENT_SELLER_ID || "seller_655656ac86b8";
export const NEEDLES_PRODUCT_ID = import.meta.env.VITE_NEEDLES_PRODUCT_ID || "product_76351c184fac";

if (!API_BASE) {
  console.error("Missing VITE_API_BASE. Set it in Vercel Environment Variables for production.");
}
