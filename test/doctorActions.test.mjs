import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appointmentsSource = await readFile(new URL("../src/components/appointments.jsx", import.meta.url), "utf8");
const chatSource = await readFile(new URL("../src/components/chat.jsx", import.meta.url), "utf8");
const dashboardStyles = await readFile(new URL("../src/styles/dashboard.css", import.meta.url), "utf8");

test("Call patient reveals and copies the authorized appointment phone without triggering a backend call", () => {
  assert.match(appointmentsSource, /title=\{selectedPatientPhone \? "Show patient phone number"/);
  assert.match(appointmentsSource, /Use your phone to dial this number/);
  assert.match(appointmentsSource, /confirmLabel="Copy number"/);
  assert.match(appointmentsSource, /navigator\.clipboard\.writeText\(phone\)/);
  assert.doesNotMatch(appointmentsSource, /appointments\/\$\{appointment\.id\}\/call/);
});

test("No reply needed remains contract-gated and survives a transient task refresh failure", () => {
  assert.match(chatSource, /responseTask\?\.stream_message_id && responseTask\?\.no_reply_needed\?\.endpoint/);
  assert.match(chatSource, /const endpoint = responseTask\.no_reply_needed\?\.endpoint/);
  assert.doesNotMatch(chatSource, /setNeedsReplyTasks\(\(current\) => \(current\.length \? \[\] : current\)\)/);
});

test("narrow Patient Hub headers keep conversation actions visible", () => {
  assert.match(dashboardStyles, /@media \(max-width: 1180px\)[\s\S]*?\.clinical-chat-header \{ flex-wrap: wrap; \}/);
  assert.match(dashboardStyles, /\.clinical-chat-actions \{ width: 100%; justify-content: flex-start; margin-left: 48px; \}/);
  assert.match(dashboardStyles, /\.local-preview-hub \{ grid-template-columns: minmax\(240px, 280px\) minmax\(0, 1fr\); \}/);
  assert.match(dashboardStyles, /\.local-preview-thread > header button \{ grid-column: 2; width: fit-content; \}/);
});
