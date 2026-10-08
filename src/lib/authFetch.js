let apiTokenProvider = null;

export function setApiTokenProvider(provider) {
  apiTokenProvider = typeof provider === "function" ? provider : null;
}

function shouldAttachAuth(url) {
  const raw = String(url || "");
  if (!raw) return false;

  try {
    const parsed = new URL(raw, window.location.origin);
    return parsed.pathname.startsWith("/doctor/")
      || parsed.pathname.includes("/doctor/")
      || /\/orders\/[^/]+\/results\/pdf$/.test(parsed.pathname);
  } catch {
    return raw.startsWith("/doctor/")
      || raw.includes("/doctor/")
      || /\/orders\/[^/]+\/results\/pdf$/.test(raw);
  }
}

export async function authFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});

  if (shouldAttachAuth(url) && apiTokenProvider && !headers.has("Authorization")) {
    const token = await apiTokenProvider();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });
  if (response.ok && !["GET", "HEAD"].includes(String(options.method || "GET").toUpperCase()) && shouldAttachAuth(url)) {
    window.dispatchEvent(new Event("doctor-data-changed"));
  }
  return response;
}

export async function fetchJson(url, options) {
  const response = await authFetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || data.error || `request_failed_${response.status}`);
    error.payload = data;
    error.status = response.status;
    throw error;
  }
  return data;
}
