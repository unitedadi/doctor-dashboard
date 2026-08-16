import { fetchJson } from "./authFetch.js";

const DOCTOR_CHAT_WORKER_PATH = "/doctor-chat-sw.js";

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
      detail: "Appointments, messages, and refill requests remain in their work queues.",
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
  await navigator.serviceWorker.register(DOCTOR_CHAT_WORKER_PATH, { scope: "/" });
  return navigator.serviceWorker.ready;
}

function workerPath(registration) {
  const worker = registration?.active || registration?.waiting || registration?.installing;
  if (!worker?.scriptURL) return "";
  try {
    return new URL(worker.scriptURL).pathname;
  } catch {
    return "";
  }
}

function pushActivationError(stage, error, repairAttempted) {
  const failure = new Error("doctor_chat_push_activation_failed");
  failure.code = typeof error?.code === "string" ? error.code : "doctor_chat_push_activation_failed";
  failure.stage = stage;
  failure.browserErrorName = String(error?.name || "Error");
  failure.repairAttempted = repairAttempted;
  return failure;
}

export function doctorChatPushFailure(error) {
  const stage = String(error?.stage || "unknown");
  const labels = {
    save_subscription: "Could not save alerts",
    repair_registration: "Chrome repair failed",
    subscribe_after_repair: "Chrome push failed",
  };
  return {
    code: String(error?.code || "doctor_chat_push_activation_failed"),
    stage,
    browserErrorName: String(error?.browserErrorName || error?.name || "Error"),
    repairAttempted: Boolean(error?.repairAttempted),
    label: labels[stage] || "Chrome alerts failed",
  };
}

async function removeOwnedWorker(registration, expectedWorkerPath) {
  if (!registration) return;
  if (workerPath(registration) !== expectedWorkerPath) {
    const error = new Error("doctor_chat_push_worker_not_owned");
    error.code = "doctor_chat_push_worker_not_owned";
    throw error;
  }
  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();
  } catch {
    // A broken PushManager is the reason for the repair; unregistering can still recover it.
  }
  await registration.unregister();
}

export async function subscribeDoctorChatPush({
  publicKey,
  register = registerWorker,
  findRegistration = () => navigator.serviceWorker.getRegistration("/"),
  keyFactory = applicationServerKey,
  expectedWorkerPath = DOCTOR_CHAT_WORKER_PATH,
}) {
  const subscribeOptions = {
    userVisibleOnly: true,
    applicationServerKey: keyFactory(publicKey),
  };
  let registration;
  try {
    registration = await register();
    const existing = await registration.pushManager.getSubscription();
    return existing || await registration.pushManager.subscribe(subscribeOptions);
  } catch {
    try {
      await removeOwnedWorker(registration || await findRegistration(), expectedWorkerPath);
    } catch (repairError) {
      throw pushActivationError("repair_registration", repairError, true);
    }

    try {
      const repairedRegistration = await register();
      return await repairedRegistration.pushManager.subscribe(subscribeOptions);
    } catch (retryError) {
      throw pushActivationError("subscribe_after_repair", retryError, true);
    }
  }
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

  const subscription = await subscribeDoctorChatPush({ publicKey: server.vapid_public_key });
  try {
    await saveSubscription(apiBase, doctorId, subscription);
  } catch (error) {
    throw pushActivationError("save_subscription", error, false);
  }
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
