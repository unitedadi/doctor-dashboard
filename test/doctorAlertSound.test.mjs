import test from "node:test";
import assert from "node:assert/strict";

import {
  createDoctorAlertMessageHandler,
  createDoctorTabAttention,
  startDoctorAlertSound,
} from "../src/lib/doctorAlertSound.js";

test("shows a private tab indicator in the background and clears it on return", () => {
  const documentListeners = new Map();
  const windowListeners = new Map();
  let focused = false;
  const icon = {
    href: "/favicon.svg",
    setAttribute: (name, value) => {
      if (name === "href") icon.href = value;
    },
  };
  const documentTarget = {
    title: "DarDoc Doctor Dashboard",
    hidden: true,
    hasFocus: () => focused,
    querySelector: () => icon,
    addEventListener: (name, listener) => documentListeners.set(name, listener),
    removeEventListener: (name) => documentListeners.delete(name),
  };
  const eventTarget = {
    addEventListener: (name, listener) => windowListeners.set(name, listener),
    removeEventListener: (name) => windowListeners.delete(name),
  };
  const attention = createDoctorTabAttention({ documentTarget, eventTarget });

  assert.equal(attention.show(), true);
  assert.equal(documentTarget.title, "● New activity | DarDoc Doctor Dashboard");
  assert.equal(icon.href, "/favicon-alert.svg");

  documentTarget.hidden = false;
  focused = true;
  documentListeners.get("visibilitychange")();
  assert.equal(documentTarget.title, "DarDoc Doctor Dashboard");
  assert.equal(icon.href, "/favicon.svg");
  assert.equal(attention.show(), false);
  assert.equal(documentTarget.title, "DarDoc Doctor Dashboard");

  attention.stop();
  assert.equal(documentListeners.size, 0);
  assert.equal(windowListeners.size, 0);
});

test("plays one foreground chime for each supported doctor alert type", () => {
  const played = [];
  const storage = new Map();
  const handler = createDoctorAlertMessageHandler({
    play: (type) => played.push(type),
    storage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
  });

  for (const [eventId, type] of [
    ["appointment-1", "appointment.new"],
    ["message-1", "message.new"],
    ["refill-1", "refill_request.new"],
  ]) {
    assert.equal(handler({ data: { source: "dardoc-doctor-alert", event_id: eventId, type } }), true);
  }

  assert.deepEqual(played, ["appointment.new", "message.new", "refill_request.new"]);
});

test("never replays the same alert or unknown service-worker messages", () => {
  let plays = 0;
  const handler = createDoctorAlertMessageHandler({
    play: () => { plays += 1; return true; },
    storage: null,
  });
  const alert = { data: { source: "dardoc-doctor-alert", event_id: "message-1", type: "message.new" } };

  assert.equal(handler(alert), true);
  assert.equal(handler(alert), false);
  assert.equal(handler({ data: { source: "somewhere-else", event_id: "message-2", type: "message.new" } }), false);
  assert.equal(handler({ data: { source: "dardoc-doctor-alert", event_id: "lab-1", type: "lab.new" } }), false);
  assert.equal(plays, 1);
});

test("starts sound on load when Chrome already allows audio", async () => {
  const serviceWorkerListeners = new Map();
  const windowListeners = new Map();
  const played = [];
  let soundReady = false;
  let unlocks = 0;

  const stop = startDoctorAlertSound({
    serviceWorker: {
      addEventListener: (name, listener) => serviceWorkerListeners.set(name, listener),
      removeEventListener: (name) => serviceWorkerListeners.delete(name),
    },
    eventTarget: {
      addEventListener: (name, listener) => windowListeners.set(name, listener),
      removeEventListener: (name) => windowListeners.delete(name),
    },
    unlockSound: async () => {
      unlocks += 1;
      soundReady = true;
      return true;
    },
    play: (type) => {
      if (!soundReady) return false;
      played.push(type);
      return true;
    },
    storage: null,
    tabAttention: { show: () => undefined, stop: () => undefined },
  });

  await Promise.resolve();
  assert.equal(unlocks, 1);
  assert.equal(serviceWorkerListeners.get("message")({
    data: {
      source: "dardoc-doctor-alert",
      event_id: "message-after-load",
      type: "message.new",
    },
  }), true);
  assert.deepEqual(played, ["message.new"]);

  stop();
});

test("keeps an alert pending until the first user interaction unlocks sound", async () => {
  const serviceWorkerListeners = new Map();
  const windowListeners = new Map();
  const played = [];
  let soundReady = false;
  let unlocks = 0;
  let attentionShows = 0;
  let attentionStops = 0;

  const stop = startDoctorAlertSound({
    serviceWorker: {
      addEventListener: (name, listener) => serviceWorkerListeners.set(name, listener),
      removeEventListener: (name) => serviceWorkerListeners.delete(name),
    },
    eventTarget: {
      addEventListener: (name, listener) => windowListeners.set(name, listener),
      removeEventListener: (name) => windowListeners.delete(name),
    },
    unlockSound: async () => {
      unlocks += 1;
      if (unlocks === 1) return false;
      soundReady = true;
      return true;
    },
    play: (type) => {
      if (!soundReady) return false;
      played.push(type);
      return true;
    },
    storage: null,
    tabAttention: {
      show: () => { attentionShows += 1; },
      stop: () => { attentionStops += 1; },
    },
  });

  const alert = {
    data: {
      source: "dardoc-doctor-alert",
      event_id: "message-before-click",
      type: "message.new",
    },
  };
  assert.equal(serviceWorkerListeners.get("message")(alert), false);
  assert.deepEqual(played, []);
  assert.equal(attentionShows, 1);

  await windowListeners.get("pointerdown")();
  assert.deepEqual(played, ["message.new"]);
  assert.equal(unlocks, 2);

  assert.equal(serviceWorkerListeners.get("message")(alert), false);
  assert.deepEqual(played, ["message.new"]);
  assert.equal(attentionShows, 1);

  stop();
  assert.equal(serviceWorkerListeners.size, 0);
  assert.equal(windowListeners.size, 0);
  assert.equal(attentionStops, 1);
});
