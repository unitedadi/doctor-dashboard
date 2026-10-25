import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import test from "node:test";

const patientsSource = await readFile(new URL("../src/components/patients.jsx", import.meta.url), "utf8");
const patientChartSource = await readFile(new URL("../src/components/patientChart.jsx", import.meta.url), "utf8");

test("Patient Hub opens the complete chart in Production and local preview", () => {
  assert.match(patientsSource, /initialChart=\{LOCAL_PREVIEW \? localPreviewPatientChart\(p\) : undefined\}/);
  assert.match(patientsSource, /mode="full"/);
  assert.doesNotMatch(patientsSource, /mode=\{embedded \? "hub" : "full"\}/);
});

test("the complete chart exposes doctor notes with clinical and handoff categories", () => {
  assert.match(patientChartSource, /<DoctorNotes chart=\{chart\}/);
  assert.match(patientChartSource, /value: "CLINICAL_NOTE", label: "Clinical note"/);
  assert.match(patientChartSource, /value: "ADMIN_HANDOFF", label: "Handoff note"/);
  assert.match(patientChartSource, /contextType === "PATIENT_HUB" \? PATIENT_HUB_NOTE_CATEGORIES : NOTE_CATEGORIES/);
});

test("Patient Hub avoids repeating care and safety information", () => {
  assert.match(patientChartSource, /!focusedMode && focus !== "patient-hub"/);
  const profileStart = patientChartSource.indexOf('<ChartSection title="Clinical profile"');
  const profileEnd = patientChartSource.indexOf("</ChartSection>", profileStart);
  const profileSource = patientChartSource.slice(profileStart, profileEnd);
  assert.doesNotMatch(profileSource, /label="Current medication"/);
  assert.doesNotMatch(profileSource, /label="Allergies"/);
  assert.doesNotMatch(profileSource, /label="Conditions"/);
});

// Synthetic chart contract: EXPIRED membership, no member_health_profiles row.
// The backend supplies the preserved legacy measurements/intake in the chart.
const expiredChart = {
  patient: { id: "expired-wlp-test", customer_id: "synthetic-customer", name: "Synthetic Member", initials: "SM" },
  program: { subscription_status: "EXPIRED", membership_label: "Expired", track_keys: ["weight-loss"] },
  clinical: {
    demographics: { height_cm: 171, weight_kg: 93 },
    assessment: {
      submissions: [
        {
          id: "assessment-new", kind: "weight-loss", submitted_at: "2026-09-19T10:00:00Z",
          answers: Object.fromEntries([
            ...Array.from({ length: 12 }, (_, i) => [`question_${i}`, `Response ${i}`]),
            ["treatment_response", "Latest response beyond twelve answers"],
          ]),
        },
        { id: "assessment-old", kind: "weight-loss", submitted_at: "2026-06-29T10:00:00Z", answers: { treatment_response: "Older treatment response" } },
        {
          id: "legacy-weight", kind: "generic", submission_source: "LEGACY", submitted_at: "2026-04-01T10:00:00Z",
          answers: { weight_kg: "93" },
        },
        {
          id: "legacy-vitals", kind: "generic", submission_source: "LEGACY", submitted_at: "2026-03-01T10:00:00Z",
          answers: { height_cm: "171", weight_kg: "95" },
        },
        {
          id: "legacy-intake", kind: "weight-loss", submission_source: "LEGACY", submitted_at: "2026-03-01T10:00:00Z",
          answers: { prior_treatment: "Synthetic older intake" },
          ordered_answers: [{ question_id: "prior_treatment", label: "Previous treatment", answer: "Synthetic older intake" }],
        },
      ],
    },
  },
  refills: [
    ["oct", "2026-10-20T10:00:00Z", 79, "LESS_THAN_4KG", "STAY_CURRENT_DOSE", "NONE", "SATISFIED"],
    ["sep", "2026-09-19T10:00:00Z", 84, "FOUR_TO_SEVEN_KG", "INCREASE_DOSE", "MILD", "NEUTRAL"],
    ["jun", "2026-06-29T10:00:00Z", 89, "EIGHT_TO_TWELVE_KG", "LOWER_DOSE", "MODERATE", "DISSATISFIED"],
  ].map(([id, submitted_at, weight, progress, dose, sideEffects, delivery], index) => {
    const answers = {
      current_weight_kg: weight, weight_loss_last_month: progress, dosage_adjustment: dose,
      side_effects: sideEffects, delivery_experience: delivery, doctor_message: `Response for ${id}`,
      dose_response: `Dose response ${id}`, side_effect_details: `Side-effect details ${id}`,
    };
    // Cover both chart fields and older responses retained in answers_json.
    return { id, submitted_at, status: "PRESCRIBED", ...(index < 2 ? answers : {}), answers_json: answers };
  }),
};

test("expired WLP chart preserves clinical history from the chart response", async (t) => {
  const cwd = fileURLToPath(new URL("../", import.meta.url));
  await mkdir(new URL("../output/", import.meta.url), { recursive: true });
  const harness = await mkdtemp(`${cwd}output/chart-history-`);
  await writeFile(`${harness}/index.html`, `<!doctype html><div id="root"></div>
    <style>html,body,#root { height: auto; overflow: visible; }</style>
    <script type="module">
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { setActiveDoctorAccount } from '/src/config.js';
      import '/src/data.js';
      import '/src/components/shell.jsx';
      import '/src/components/clinicalUi.jsx';
      import '/src/components/patientChart.jsx';
      import '/src/styles/dashboard.css';
      const root = createRoot(document.getElementById('root'));
      window.mountChart = (patientId, account = 'mp_sami') => {
        setActiveDoctorAccount(account);
        root.render(React.createElement(window.DD_PatientChart, { key: account + patientId, patientId }));
      };
    </script>`);
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd,
    env: { ...process.env, VITE_API_BASE: "/api", VITE_API_PROXY_TARGET: "http://127.0.0.1:1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  server.stdout.on("data", (chunk) => { serverOutput += chunk; });
  server.stderr.on("data", (chunk) => { serverOutput += chunk; });
  let browser;
  try {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (server.exitCode !== null) throw new Error(serverOutput);
      if (await fetch(origin).then((response) => response.ok).catch(() => false)) break;
      await delay(25);
    }
    browser = await chromium.launch({ channel: "chromium" });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const requests = [];
    const errors = [];
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith("/api/")) return route.continue();
      requests.push(`${request.method()} ${url.pathname}${url.search}`);
      if (request.method() !== "GET") return route.abort();
      if (url.pathname.endsWith("/chart")) {
        const allowed = url.pathname.includes("/expired-wlp-test/") && url.searchParams.get("doctor_id") === "doctor_sami_dev";
        return route.fulfill(allowed ? { json: expiredChart } : { status: 404, json: { error: "patient_not_found" } });
      }
      if (url.pathname.endsWith("/demographics")) return route.fulfill({ json: { patient: { name: "Synthetic Member", gender: "other", missing_fields: [] } } });
      // Reproduces the old endpoint's default PENDING_REVIEW response.
      return route.fulfill({ json: { requests: [] } });
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${origin}/${harness.slice(cwd.length)}/index.html`);
    await page.waitForFunction(() => typeof window.mountChart === "function");
    await page.evaluate(() => window.mountChart("expired-wlp-test"));
    await page.getByRole("heading", { name: "Synthetic Member", exact: true }).waitFor();

    await t.test("all three PRESCRIBED check-ins expose dated weight, progress, dose and response answers", async () => {
      const cards = page.locator(".patient-refill-review-card");
      assert.equal(await cards.count(), 3);
      for (const [i, values] of [
        ["Oct 20", "79 kg", "Less than 4 kg", "Stay on current dose", "None reported", "Satisfied", "Response for oct", "Dose Response Oct", "Side Effect Details Oct"],
        ["Sep 19", "84 kg", "4 kg to 7 kg", "Increase dose", "Mild", "Neutral", "Response for sep", "Dose Response Sep", "Side Effect Details Sep"],
        ["Jun 29", "89 kg", "8 kg to 12 kg", "Lower dose", "Moderate", "Dissatisfied", "Response for jun", "Dose Response Jun", "Side Effect Details Jun"],
      ].entries()) {
        const text = await cards.nth(i).innerText();
        for (const value of values) assert.ok(text.includes(value), `check-in ${i}: ${value}`);
      }
    });
    await t.test("older assessments and answers beyond the twelfth remain readable", async () => {
      const text = await page.locator(".patient-assessment-section").innerText();
      assert.ok(text.includes("Older Treatment Response"));
      assert.ok(text.includes("Jun 29"));
      assert.ok(text.includes("Latest Response Beyond Twelve Answers"));
    });
    await t.test("legacy height and weight render without a health-profile row", async () => {
      assert.ok((await page.locator(".patient-chart-overview").innerText()).includes("171 cm · 93 kg"));
      const submissions = page.locator(".patient-assessment-section article");
      assert.equal(await submissions.count(), 5);
      const initialVitals = await submissions.nth(3).innerText();
      for (const value of ["Mar 1", "171", "95"]) assert.ok(initialVitals.includes(value));
      const laterWeight = await submissions.nth(2).innerText();
      for (const value of ["Apr 1", "93"]) assert.ok(laterWeight.includes(value));
      const intake = await submissions.nth(4).textContent();
      for (const value of ["Mar 1", "Previous treatment", "Synthetic Older Intake"]) assert.ok(intake.includes(value), value);
    });
    await t.test("the chart never requests status-mismatched refill details", () => {
      assert.equal(requests.some((url) => url.includes("/rx/refill-requests")), false);
      assert.deepEqual(errors, []);
    });
    await page.screenshot({ path: `${cwd}output/expired-wlp-chart-history.png`, fullPage: true });
    await t.test("an unrelated doctor's denied chart never falls back to fetching clinical history", async () => {
      const start = requests.length;
      await page.evaluate(() => window.mountChart("expired-wlp-test", "mp_marwa"));
      await page.getByText("patient_not_found", { exact: true }).waitFor();
      assert.equal(await page.locator(".patient-refill-review-card").count(), 0);
      assert.equal(await page.getByRole("heading", { name: "Synthetic Member", exact: true }).count(), 0);
      assert.equal(requests.slice(start).length, 1);
      assert.ok(requests[start].includes("/expired-wlp-test/chart?doctor_id=doctor_marwa"));
      assert.deepEqual(errors, []);
    });
    assert.ok(requests.every((url) => url.startsWith("GET ")), "only read requests were issued");
  } finally {
    await browser?.close();
    server.kill();
    await rm(harness, { recursive: true, force: true });
  }
});
