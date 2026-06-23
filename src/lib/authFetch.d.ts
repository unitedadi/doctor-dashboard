export function setApiTokenProvider(provider?: (() => Promise<string | null> | string | null) | null): void
export function authFetch(url: RequestInfo | URL, options?: RequestInit): Promise<Response>
export function fetchJson<T = unknown>(url: RequestInfo | URL, options?: RequestInit): Promise<T>
