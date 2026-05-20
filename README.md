# doctor-dashboard

DarDoc doctor dashboard for appointments, patients, chat, and Rx care-plan prescribing.

## Local Development

```bash
npm install
npm run dev
```

Local dev runs on Vite and uses `.env.development`:

```env
VITE_API_BASE=/api
VITE_DOCTOR_ID=doctor_sami_dev
VITE_API_PROXY_TARGET=https://api-staging.dardoc.com
```

`/api` is proxied by Vite to the backend target, so browser code can keep calling `/api/...` locally.

## Production / Vercel

Vercel does not use the Vite dev proxy. Set this in Vercel Environment Variables for both Preview and Production:

```env
VITE_API_BASE=https://api-staging.dardoc.com
VITE_DOCTOR_ID=doctor_sami_dev
```

Then deploy normally from the linked GitHub repo. The project includes `vercel.json` with:

- framework: `vite`
- build command: `npm run build:prod`
- output directory: `dist`
- SPA fallback rewrite to `index.html`

## Scripts

```bash
npm run dev        # local dev, uses .env.development
npm run build      # production build
npm run build:dev  # development-mode build
npm run build:prod # production-mode build
npm run preview    # preview built dist locally
npm run lint
```
