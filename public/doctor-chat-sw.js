/* global self */

const alertDefinitions = {
  "appointment.new": {
    body: "New appointment",
    url: "/?view=appointments",
  },
  "message.new": {
    body: "New patient message",
    url: "/?view=patient-hub&hub_mode=needs_reply",
  },
  "refill_request.new": {
    body: "New refill request",
    url: "/?view=clinical-inbox&category=refill_review",
  },
};

function safePath(value, fallback) {
  const path = String(value || "").trim();
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

async function notifyOpenDashboard(alert) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const target = windows.find((client) => client.focused)
    || windows.find((client) => client.visibilityState === "visible")
    || windows[0];
  target?.postMessage(alert);
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const type = alertDefinitions[data.type] ? data.type : "message.new";
  const definition = alertDefinitions[type];
  const eventId = String(data.event_id || data.tag || "").trim();
  const url = safePath(data.url, definition.url);
  const alert = {
    source: "dardoc-doctor-alert",
    event_id: eventId,
    type,
    url,
  };

  event.waitUntil(Promise.all([
    self.registration.showNotification("DarDoc Doctor Dashboard", {
      body: definition.body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: String(data.tag || eventId || `doctor-alert-${type}`),
      renotify: true,
      data: { url },
    }),
    eventId ? notifyOpenDashboard(alert) : Promise.resolve(),
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      if ("navigate" in existing) await existing.navigate(target);
      return existing.focus();
    }
    return self.clients.openWindow(target);
  })());
});
