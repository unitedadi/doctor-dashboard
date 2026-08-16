const DOCTOR_ALERT_SOURCE = "dardoc-doctor-alert";
const DOCTOR_ALERT_TYPES = new Set([
  "appointment.new",
  "message.new",
  "refill_request.new",
]);

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

export function createDoctorAlertMessageHandler({
  play = () => playDoctorAlertSound(),
  storage = globalThis.sessionStorage,
  seen = new Set(),
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
      storage?.setItem(key, "1");
    } catch {
      // The in-memory set still prevents duplicate sounds when storage is unavailable.
    }
    seen.add(key);
    return Boolean(play(alert.type));
  };
}

export function startDoctorAlertSound() {
  if (!("serviceWorker" in navigator)) return () => undefined;

  const onAlert = createDoctorAlertMessageHandler();
  const unlock = () => {
    void unlockDoctorAlertSound().catch(() => undefined);
  };
  navigator.serviceWorker.addEventListener("message", onAlert);
  window.addEventListener("pointerdown", unlock, { capture: true });
  window.addEventListener("keydown", unlock, { capture: true });

  return () => {
    navigator.serviceWorker.removeEventListener("message", onAlert);
    window.removeEventListener("pointerdown", unlock, { capture: true });
    window.removeEventListener("keydown", unlock, { capture: true });
  };
}
