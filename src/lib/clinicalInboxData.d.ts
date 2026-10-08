export type InboxData = { tasks: any[]; counts?: Record<string, number>; current_counts?: Record<string, number>; earlier_counts?: Record<string, number> }
export const INBOX_CATEGORIES: string[]
export function loadClinicalInbox(fetcher: (url: string, options?: RequestInit) => Promise<any>, apiBase: string, doctorId: string, signal?: AbortSignal, onPage?: (data: InboxData) => void): Promise<InboxData>
export function removeResolvedInboxTask<T extends InboxData>(snapshot: T, taskId: string): T
