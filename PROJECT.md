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
  - Production should use `https://api-prod.dardoc.com`.
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
