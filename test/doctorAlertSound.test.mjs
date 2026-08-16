import test from "node:test";
import assert from "node:assert/strict";

import { createDoctorAlertMessageHandler } from "../src/lib/doctorAlertSound.js";

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
