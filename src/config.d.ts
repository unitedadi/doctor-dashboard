export const API_BASE: string
export const CLERK_PUBLISHABLE_KEY: string
export const DEFAULT_DOCTOR_ACCOUNT_ID: string
export const ACTIVE_DOCTOR_ACCOUNT_ID: string
export const DOCTOR_ID: string
export const SUPPLEMENT_SELLER_ID: string
export const NEEDLES_PRODUCT_ID: string
export const DOCTOR_ACCOUNTS: Record<string, {
  accountId: string
  doctorId: string
  profile: {
    name: string
    title: string
    initials: string
    license: string
  }
}>
export function setActiveDoctorAccount(accountId?: string | null): typeof DOCTOR_ACCOUNTS[string]
export function getActiveDoctorAccount(): typeof DOCTOR_ACCOUNTS[string]
export function resolveDoctorAccountFromLocation(location?: Location): string
