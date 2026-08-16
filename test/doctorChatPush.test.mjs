import test from "node:test";
import assert from "node:assert/strict";

import {
  doctorChatPushFailure,
  subscribeDoctorChatPush,
} from "../src/lib/doctorChatPush.js";

function browserError(name) {
  return Object.assign(new Error(name), { name });
}

test("repairs the DarDoc worker once when the first Chrome subscription fails", async () => {
  let registerCalls = 0;
  let unregisterCalls = 0;
  const repairedSubscription = { endpoint: "https://push.example/repaired" };
  const staleRegistration = {
    active: { scriptURL: "https://rx.dardoc.co/doctor-chat-sw.js" },
    pushManager: {
      getSubscription: async () => null,
      subscribe: async () => { throw browserError("AbortError"); },
    },
    unregister: async () => { unregisterCalls += 1; return true; },
  };
  const repairedRegistration = {
    active: { scriptURL: "https://rx.dardoc.co/doctor-chat-sw.js" },
    pushManager: {
      getSubscription: async () => null,
      subscribe: async () => repairedSubscription,
    },
    unregister: async () => true,
  };

  const result = await subscribeDoctorChatPush({
    publicKey: "test-key",
    keyFactory: () => new Uint8Array([1, 2, 3]),
    register: async () => (++registerCalls === 1 ? staleRegistration : repairedRegistration),
    findRegistration: async () => staleRegistration,
  });

  assert.equal(result, repairedSubscription);
  assert.equal(registerCalls, 2);
  assert.equal(unregisterCalls, 1);
});

test("continues the repair when the stale PushManager cannot be read", async () => {
  let registerCalls = 0;
  let unregisterCalls = 0;
  let staleReads = 0;
  const repairedSubscription = { endpoint: "https://push.example/repaired" };
  const staleRegistration = {
    active: { scriptURL: "https://rx.dardoc.co/doctor-chat-sw.js" },
    pushManager: {
      getSubscription: async () => {
        staleReads += 1;
        if (staleReads > 1) throw browserError("InvalidStateError");
        return null;
      },
      subscribe: async () => { throw browserError("AbortError"); },
    },
    unregister: async () => { unregisterCalls += 1; return true; },
  };
  const repairedRegistration = {
    active: { scriptURL: "https://rx.dardoc.co/doctor-chat-sw.js" },
    pushManager: {
      getSubscription: async () => null,
      subscribe: async () => repairedSubscription,
    },
    unregister: async () => true,
  };

  const result = await subscribeDoctorChatPush({
    publicKey: "test-key",
    keyFactory: () => new Uint8Array([1, 2, 3]),
    register: async () => (++registerCalls === 1 ? staleRegistration : repairedRegistration),
    findRegistration: async () => staleRegistration,
  });

  assert.equal(result, repairedSubscription);
  assert.equal(unregisterCalls, 1);
});

test("never removes a service worker that is not owned by DarDoc alerts", async () => {
  let unregisterCalls = 0;
  const unrelatedRegistration = {
    active: { scriptURL: "https://rx.dardoc.co/other-worker.js" },
    pushManager: {
      getSubscription: async () => null,
      subscribe: async () => { throw browserError("AbortError"); },
    },
    unregister: async () => { unregisterCalls += 1; return true; },
  };

  await assert.rejects(
    subscribeDoctorChatPush({
      publicKey: "test-key",
      keyFactory: () => new Uint8Array([1, 2, 3]),
      register: async () => unrelatedRegistration,
      findRegistration: async () => unrelatedRegistration,
    }),
    (error) => {
      assert.deepEqual(doctorChatPushFailure(error), {
        code: "doctor_chat_push_worker_not_owned",
        stage: "repair_registration",
        browserErrorName: "Error",
        repairAttempted: true,
        label: "Chrome repair failed",
      });
      return true;
    },
  );
  assert.equal(unregisterCalls, 0);
});

test("reports the exact safe stage when Chrome still fails after repair", async () => {
  const registration = {
    active: { scriptURL: "https://rx.dardoc.co/doctor-chat-sw.js" },
    pushManager: {
      getSubscription: async () => null,
      subscribe: async () => { throw browserError("AbortError"); },
    },
    unregister: async () => true,
  };

  await assert.rejects(
    subscribeDoctorChatPush({
      publicKey: "test-key",
      keyFactory: () => new Uint8Array([1, 2, 3]),
      register: async () => registration,
      findRegistration: async () => registration,
    }),
    (error) => {
      assert.deepEqual(doctorChatPushFailure(error), {
        code: "doctor_chat_push_activation_failed",
        stage: "subscribe_after_repair",
        browserErrorName: "AbortError",
        repairAttempted: true,
        label: "Chrome push failed",
      });
      return true;
    },
  );
});
