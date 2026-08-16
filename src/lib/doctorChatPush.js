import { fetchJson } from "./authFetch.js";

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function doctorChatPushRecovery(state) {
  if (state === "blocked") {
    return {
      title: "Alerts are blocked in this browser",
      detail: "Open this site's browser settings, set Notifications to Allow, then check again.",
      action: "Check again",
    };
  }
  if (state === "unavailable") {
    return {
      title: "Alerts are temporarily unavailable",
      detail: "Patient messages still appear in Needs reply.",
      action: "Try again",
    };
  }
  return null;
}

function applicationServerKey(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function loadServerStatus(apiBase, doctorId) {
  const params = new URLSearchParams({ doctor_id: doctorId });
  return fetchJson(`${apiBase}/doctor/chat/push?${params.toString()}`);
}

async function registerWorker() {
  await navigator.serviceWorker.register("/doctor-chat-sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

async function saveSubscription(apiBase, doctorId, subscription) {
  return fetchJson(`${apiBase}/doctor/chat/push/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doctor_id: doctorId, subscription: subscription.toJSON() }),
  });
}

export async function readDoctorChatPushState({ apiBase, doctorId }) {
  if (!pushSupported()) return { status: "unsupported", label: "Alerts unsupported" };
  const server = await loadServerStatus(apiBase, doctorId);
  if (!server.enabled || !server.vapid_public_key) return { status: "unavailable", label: "Alerts unavailable" };
  if (Notification.permission === "denied") return { status: "blocked", label: "Alerts blocked" };
  if (Notification.permission !== "granted") return { status: "off", label: "Enable alerts", publicKey: server.vapid_public_key };

  const registration = await registerWorker();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return { status: "off", label: "Enable alerts", publicKey: server.vapid_public_key };
  await saveSubscription(apiBase, doctorId, subscription);
  return { status: "on", label: "Alerts on", publicKey: server.vapid_public_key };
}

export async function enableDoctorChatPush({ apiBase, doctorId }) {
  if (!pushSupported()) return { status: "unsupported", label: "Alerts unsupported" };
  const server = await loadServerStatus(apiBase, doctorId);
  if (!server.enabled || !server.vapid_public_key) return { status: "unavailable", label: "Alerts unavailable" };

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") return { status: "blocked", label: "Alerts blocked" };

  const registration = await registerWorker();
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(server.vapid_public_key),
  });
  await saveSubscription(apiBase, doctorId, subscription);
  return { status: "on", label: "Alerts on", publicKey: server.vapid_public_key };
}

export async function disableDoctorChatPush({ apiBase, doctorId }) {
  if (!pushSupported()) return { status: "unsupported", label: "Alerts unsupported" };
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await fetchJson(`${apiBase}/doctor/chat/push/subscriptions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctor_id: doctorId, endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  }
  return { status: "off", label: "Enable alerts" };
}
