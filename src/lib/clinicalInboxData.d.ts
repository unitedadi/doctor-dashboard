export const INBOX_CATEGORIES: string[]
export function loadClinicalInbox(fetcher: (url: string, options?: RequestInit) => Promise<any>, apiBase: string, doctorId: string, signal?: AbortSignal, onPage?: (data: { tasks: any[]; counts?: Record<string, number> }) => void): Promise<{ tasks: any[]; counts?: Record<string, number> }>
