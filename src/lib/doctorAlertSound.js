const DOCTOR_ALERT_SOURCE = "dardoc-doctor-alert";
const DOCTOR_ALERT_TYPES = new Set([
  "appointment.new",
  "message.new",
  "refill_request.new",
]);
const DOCTOR_DASHBOARD_TITLE = "DarDoc Doctor Dashboard";
const DOCTOR_ATTENTION_TITLE = "● New activity | DarDoc Doctor Dashboard";

let audioContext = null;

function browserAudioContext() {
  return globalThis.AudioContext || globalThis.webkitAudioContext || null;
}

export async function unlockDoctorAlertSound({ AudioContextClass = browserAudioContext() } = {}) {
  if (!AudioContextClass) return false;
  audioContext ||= new AudioContextClass();
  if (audioContext.state === "suspended") await audioContext.resume();
  return audioContext.state === "running";
}

export function playDoctorAlertSound({ context = audioContext } = {}) {
  if (!context || context.state !== "running") return false;

  const now = context.currentTime;
  const gain = context.createGain();
  const tone = context.createOscillator();
  tone.type = "sine";
  tone.frequency.setValueAtTime(784, now);
  tone.frequency.setValueAtTime(1046.5, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  tone.connect(gain);
  gain.connect(context.destination);
  tone.start(now);
  tone.stop(now + 0.34);
  return true;
}

export function createDoctorTabAttention({
  documentTarget = globalThis.document,
  eventTarget = globalThis.window,
  title = DOCTOR_DASHBOARD_TITLE,
  attentionTitle = DOCTOR_ATTENTION_TITLE,
  favicon = "/favicon.svg",
  attentionFavicon = "/favicon-alert.svg",
} = {}) {
  if (!documentTarget) {
    return {
      show: () => false,
      clear: () => false,
      stop: () => undefined,
    };
  }

  const icon = documentTarget.querySelector?.('link[rel~="icon"]') || null;
  const show = () => {
    if (!documentTarget.hidden && documentTarget.hasFocus?.()) return false;
    documentTarget.title = attentionTitle;
    icon?.setAttribute("href", attentionFavicon);
    return true;
  };
  const clear = () => {
    documentTarget.title = title;
    icon?.setAttribute("href", favicon);
    return true;
  };
  const onVisibilityChange = () => {
    if (!documentTarget.hidden) clear();
  };

  documentTarget.addEventListener?.("visibilitychange", onVisibilityChange);
  eventTarget?.addEventListener?.("focus", clear);

  return {
    show,
    clear,
    stop: () => {
      documentTarget.removeEventListener?.("visibilitychange", onVisibilityChange);
      eventTarget?.removeEventListener?.("focus", clear);
      clear();
    },
  };
}

export function createDoctorAlertMessageHandler({
  play = () => playDoctorAlertSound(),
  storage = globalThis.sessionStorage,
  seen = new Set(),
  accepted = new Set(),
  onAccepted = () => undefined,
  onPending = () => undefined,
} = {}) {
  return (event) => {
    const alert = event?.data;
    const eventId = String(alert?.event_id || "").trim();
    if (alert?.source !== DOCTOR_ALERT_SOURCE || !DOCTOR_ALERT_TYPES.has(alert?.type) || !eventId) {
      return false;
    }

    const key = `dardoc-doctor-alert:${eventId}`;
    if (seen.has(key)) return false;
    try {
      if (storage?.getItem(key)) return false;
    } catch {
      // The in-memory set still prevents duplicates when storage is unavailable.
    }

    if (!accepted.has(key)) {
      accepted.add(key);
      try {
        onAccepted(alert);
      } catch {
        // A tab indicator failure must never prevent the foreground chime.
      }
    }

    if (!play(alert.type)) {
      onPending(alert);
      return false;
    }

    try {
      storage?.setItem(key, "1");
    } catch {
      // The in-memory set still prevents duplicates when storage is unavailable.
    }
    seen.add(key);
    return true;
  };
}

export function startDoctorAlertSound({
  serviceWorker = navigator.serviceWorker,
  eventTarget = window,
  unlockSound = unlockDoctorAlertSound,
  play = () => playDoctorAlertSound(),
  storage = globalThis.sessionStorage,
  tabAttention = createDoctorTabAttention(),
} = {}) {
  if (!serviceWorker) {
    tabAttention.stop();
    return () => undefined;
  }

  const pending = new Map();
  const handleAlert = createDoctorAlertMessageHandler({
    play,
    storage,
    onAccepted: () => tabAttention.show(),
    onPending: (alert) => pending.set(alert.event_id, alert),
  });
  const onAlert = (event) => {
    const played = handleAlert(event);
    if (played) pending.delete(event?.data?.event_id);
    return played;
  };
  const unlock = async () => {
    try {
      if (!(await unlockSound())) return false;
      for (const alert of pending.values()) {
        if (handleAlert({ data: alert })) pending.delete(alert.event_id);
      }
      return true;
    } catch {
      return false;
    }
  };
  serviceWorker.addEventListener("message", onAlert);
  eventTarget.addEventListener("pointerdown", unlock, { capture: true });
  eventTarget.addEventListener("keydown", unlock, { capture: true });

  return () => {
    serviceWorker.removeEventListener("message", onAlert);
    eventTarget.removeEventListener("pointerdown", unlock, { capture: true });
    eventTarget.removeEventListener("keydown", unlock, { capture: true });
    tabAttention.stop();
  };
}
