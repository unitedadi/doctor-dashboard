export const INBOX_CATEGORIES: string[]
export function loadClinicalInbox(fetcher: (url: string, options?: RequestInit) => Promise<any>, apiBase: string, doctorId: string, signal?: AbortSignal): Promise<{ tasks: any[]; counts?: Record<string, number> }>
