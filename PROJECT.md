# Doctor Dashboard Project Memory

Last reviewed: 2026-06-15 14:34 +04

## Purpose

Doctor Dashboard is the DarDoc doctor-facing operations surface. It lets doctors review appointments, open patient charts, use clinical chat, complete consultations, handle refills, review Quick WLP requests, and create Rx care-plan prescriptions.

The business goal is to reduce manual founder/CX intervention by giving doctors and ops users the workflows they need inside the dashboard. If a support request repeats, prefer turning it into a dashboard capability over doing one-off manual fixes.

## Business Context

- DarDoc sells and coordinates healthcare services including weight-loss consultations, GLP-1 prescribing, peptide/supplement care plans, refills, and Quick WLP checkout flows.
- Prescription publishing is gated by completed consultations. If a doctor cannot mark a consultation complete, they may be blocked from prescribing even when the consultation happened.
- CX, partners, and doctors often report issues through chat. Tasks should preserve the user-facing problem, not only the code symptom.
- Doctor Dashboard is currently the first project used to prove the Linear + Mac mini + Codex automation loop.

## Primary Users

- Doctors: review daily schedule, join video consultations, call patients, complete consultations, prescribe allowed products, and follow up via chat.
- CX or ops: use the dashboard indirectly through doctors, support troubleshooting, and request product improvements when repeated manual intervention is needed.
- Aditya: reviews and approves code changes, especially UI changes, through Linear activity screenshots before pushing.

## Product Areas

- Appointments: default to today's clinic, show selected date appointments, join video sessions, call patients, open charts, and complete consultations.
- Patients: list Rx patients and patient details with consultation context.
- Chat: patient messaging and prescription entry points, with completed-consultation gating.
- Prescribe: create or update prescription/care-plan outputs for eligible patients and products.
- Refills: review refill requests and route into prescribing.
- Quick WLP: review booked consultation details and create checkout intents.

## Technical Shape

- Framework: Vite + React.
- Auth: Clerk in normal app usage.
- Local UI review: use `VITE_SKIP_CLERK=1` so Codex/Playwright can render the app without OAuth.
- API base:
  - Local development uses `VITE_API_BASE=/api`.
  - Vite proxies `/api` to `VITE_API_PROXY_TARGET`.
  - Production should use `https://realbackend-api-prod.ambitiousmeadow-4e77b741.uaenorth.azurecontainerapps.io`.
- Current doctor account defaults to `mp_sami` / `doctor_sami_dev`.

## Commands

- Install: `npm install`
- Dev: `npm run dev -- --host 0.0.0.0 --port 3001`
- Dev for automated UI review: `VITE_SKIP_CLERK=1 npm run dev -- --host 0.0.0.0 --port 3001`
- Build: `npm run build`
- Lint: `npm run lint`

## Verification Rules

- Run `npm run build` after code changes.
- For UI changes, run the app with `VITE_SKIP_CLERK=1`, capture a screenshot, and attach it to the Linear issue activity before asking for review.
- For date or routing changes, verify the browser state and the actual API request parameters when possible.
- Do not push, deploy, merge, or modify production/customer data unless explicitly approved.

## Automation Rules

- Every new project task must start by reading this file.
- Every completed project task must update the Task History section with:
  - timestamp,
  - source issue or request,
  - files or areas changed,
  - verification performed,
  - remaining risks or follow-ups.
- Keep entries concise. This file is project memory, not a full transcript.
- If a task discovers durable business or technical context, update the relevant section above, not only Task History.

## Current Known Decisions

- Use Linear as the review board for Mac mini tasks.
- Keep Doctor Dashboard as the first repo for proving the automation flow before expanding to other projects.
- UI changes should be reviewed from screenshots attached to Linear.
- Skip-Clerk mode is intentional for automated local UI review only.
- Code changes should stay local/reviewable until Aditya approves push.

## Task History

### 2026-08-16 14:40 +04 - Restore post-call consultation completion

- Source: Dr. Marwa reported that `Record outcome` never appeared after Karina Manaf's Production consultation.
- Changed Schedule so a successful session launch advances the selected appointment to `Complete consultation`, and an overdue booked slot exposes completion even if the page was refreshed after the call.
- Verification: local mocked workflow confirmed overdue `BOOKED` → `Complete consultation` → completed → `Record outcome`, an active session changed `Join` to `Complete`, browser console stayed clean, and `npm run lint` plus `npm run build:prod` passed.
- Follow-up: Karina's clinical record remains unchanged; Dr. Marwa must complete it through the repaired dashboard before recording the outcome.

### 2026-08-15 22:20 +04 - All-time physician review rating

- Source: Keswin confirmed Doctor Dashboard must show each physician's all-time review rating rather than a 90-day window.
- Changed the dashboard to consume RealBackend's `response_count` field so the authenticated all-time average and review count can render in the account row and menu.
- Verification: paired RealBackend all-time/eligibility contract tests passed 12/12, backend typecheck passed, and frontend lint/build passed. Signed-in DEV Preview isolation remains pending.
- Follow-up: RealBackend owns genuine-patient eligibility and excludes staff/canary feedback; Production remains gated on authenticated DEV proof.

### 2026-08-15 20:10 +04 - Re-issue prescription price hydration

- Source: Keswin reported the DEV-backed re-issue review displayed AED 0 even though the current catalogue had non-zero prices.
- Changed re-issue prefilling to wait for the live catalogue, hydrate medication and needle prices from backend-owned product records, and fail closed with `Price unavailable` when any item cannot be priced.
- Verification: `npm run lint` and `npm run build` passed; read-only browser QA against RealBackend DEV rendered Mounjaro at AED 1,734, needles at AED 10, and the combined total at AED 1,744 with no console warnings. No prescription was submitted.
- Follow-up: authenticated DEV submission and persistence remain a separate authorized integration boundary.

### 2026-08-14 14:00 +04 - Doctor chat browser alerts

- Source: Keswin approved the lean first alert boundary for Doctor Dashboard chat: GetStream event, RealBackend verification, generic browser notification, and exact-chat deep link.
- Added an authenticated browser-push opt-in control, service worker, subscription sync/removal, and direct Patient Hub channel routing. Notifications deliberately exclude patient names, message text, and clinical details.
- Verification: `npm run build` passed; service-worker JavaScript checks passed; local Chrome QA confirmed the alert control, unavailable state, and direct Patient Hub URL routing. Focused RealBackend tests passed 12/12 and backend TypeScript passed in the paired clean worktree.
- Follow-up: RealBackend DEV now has the migration, VAPID keys, and an isolated GetStream DEV webhook. The frontend Preview and full browser delivery still need DEV proof; no Production release was applied. Local skip-Clerk still proxies Production by default, so use the authenticated Preview against RealBackend DEV for release QA.

### 2026-07-01 13:24 +04 - Medication fulfillment state rendering

- Source: Keswin reported Marwa Doctor Dashboard showed a cancelled/pending-payment Rx patient as paid awaiting delivery while Ops Portal did not list the patient in Rx Programs or Pharmacy Ops.
- Changed Patient Chart and Patients views to prefer backend `lifecycle` / `medication_fulfillment` payment and delivery state before falling back to older delivered-medication rows.
- Verification: `npm run build` passed.
- Follow-up: deploy Doctor Dashboard frontend so the live UI consumes the backend contract now live.

### 2026-06-24 20:53 +04 - Consultation outcome frontend

- Source: doctor-dashboard clinical workflow cleanup after backend introduced explicit consultation outcomes.
- Changed Schedule, Clinical Inbox, and Patient Hub to show `Record outcome` for completed follow-up consults that need an explicit clinical decision instead of incorrectly showing `Issue prescription`.
- Added a shared consultation outcome modal with outcome choices and internal note support.
- Verification: `npm run build:prod` passed; Playwright smoke confirmed the Clinical Inbox `Needs outcome` filter, `Record outcome` CTA, and modal render locally. `npm run lint` still fails on pre-existing `src/App.tsx` and `src/main.tsx` rules unrelated to this change.
- Follow-up: deploy requires backend outcome endpoint to be live.

### 2026-06-15 14:47 +04 - DAR-1766 empty appointment text

- Source: Linear DAR-1766 requested changing the empty appointment copy.
- Changed the appointments empty-state text to `No appointments scheduled for this date`.
- Verification: local `npm run build` passed.
- Follow-up: none.

### 2026-06-15 14:34 +04 - DAR-1765 appointments date navigation

- Source: doctor reported they could not prescribe for a yesterday client because the consultation had not been marked complete and the appointments view only showed today.
- Changed appointments so the default date is today, with previous-day, today, and next-day controls.
- Changed appointments API calls to use the selected date.
- Made `Complete Consultation` available for any non-completed appointment, not only upcoming video appointments with a meeting link.
- Verification: local `npm run build`, Mac mini `npm run build`, skip-Clerk screenshot attached to Linear, and browser check confirmed date changed from 2026-06-15 to 2026-06-14 with matching API request dates.
- Follow-up: consider broader week/month navigation only if doctors ask for it.

### 2026-06-15 14:34 +04 - DAR-1763 doctor dashboard chrome cleanup and UI review setup

- Source: Aditya requested removing visible doctor/account labels from Doctor Dashboard.
- Removed the top-right `mp_sami` session capsule.
- Removed the `For Doctors` capsule from the sidebar brand area.
- Added `VITE_SKIP_CLERK` support so automated screenshots can bypass Clerk and render the actual dashboard shell.
- Verification: `npm run build` passed locally and on the Mac mini; skip-Clerk dashboard screenshot was attached to Linear.
