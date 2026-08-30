# 21again — full project source (backup / recovery)

This branch is the **complete, recoverable source** for the 21again app. If the original laptop is lost, everything needed to rebuild, run, deploy and submit the app is here.

## What's in here
- **`Thermal Kitchen.dc.html`** — the single source-of-truth for the entire app (dc-runtime React, ~2200 lines). Editing the app = editing this file.
- **`build/`** — the build toolchain:
  - `build.ps1` — inlines React + images into a single self-contained `app-21.html`, stamps the version, writes `version.json`, and adds the loader/skeleton. Output goes to `app-store-package/www/index.html`.
  - `react.js`, `react-dom.js` — React 18 UMD bundles embedded by the build.
  - `serve.ps1` — a tiny local static server (`http://localhost:8321`) for testing the built app.
  - `deploy-scan.ps1` — deploys the Supabase edge function via the Management API (reads `SUPABASE_ACCESS_TOKEN` from the environment).
- **`image-slot.js`, `support.js`** — runtime web components / helpers inlined by the build.
- **`public/`, `assets/`** — recipe photos and the logo mark used by the app.
- **`app-store-package/`** — the Capacitor iOS project:
  - `www/index.html` — the latest built app (what GitHub Pages serves).
  - `backend/scan/index.ts` — the Supabase edge function (v21: AI scan/import/chat, signup, account delete, SSRF + rate-limit hardening).
  - `capacitor.config.json`, `package.json` — native config + plugins (HealthKit, Local Notifications, Haptics).
  - `codemagic.yaml` — cloud iOS build/sign/submit (no Mac needed).
  - `README-BUILD-AND-SUBMIT.md`, `README-IOS-HEALTHKIT.md` — submission guides.
- **`branding/`** — theme galleries, logo candidates, beta-invite QR card.
- **`docs/`** — the audit reports and evidence logs.

## Rebuild from a clean clone (Windows / PowerShell)
```powershell
# 1. build the single-file app
.\build\build.ps1
# 2. serve & test locally
Start-Process powershell -ArgumentList '-File','.\build\serve.ps1'
# open http://localhost:8321
```
> `build.ps1` has absolute paths from the original machine — update the `$proj` and `$sp` variables at the top to wherever you clone this.

## Deploy the web app (GitHub Pages)
The live site is the `main` branch of the `recisource` repo. Copy `app-store-package/www/index.html` + `version.json` to that repo root and push. Pages URL: https://vinhnguyen065.github.io/recisource/

## Deploy the backend
Set a Supabase access token, then `./build/deploy-scan.ps1` (see the script header).

## Ship to the App Store (no Mac)
See `app-store-package/README-BUILD-AND-SUBMIT.md` → "No-Mac path" (Codemagic). Hosted legal URLs: `/privacy.html`, `/terms.html` on the Pages site.

## Live services
- **GitHub Pages** (this account, `recisource` repo, `main` branch) — the web app + privacy/terms.
- **Supabase** project `czbetvehfqqfhggqlqfp` — auth + `user_state` table + the `scan` edge function. Secrets (`ANTHROPIC_API_KEY`, service role) live in Supabase env vars, **not** in this source.
