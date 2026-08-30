# Capacity & Performance Report — 21 (2026-08-09)

## 1. Functional capacity (what the product can do today)
- **Fully working, real data:** photo→calorie logging via live AI backend; calorie diary with per-day logs, edit steppers, deletes, water; weight/steps/sleep/HR/BP tracking with editable history; medical profile (conditions/medications); grocery lists; settings incl. dark mode and JSON export; recipe library with accurate multi-dimension filtering; meal-plan browsing/swapping; persistence of all health/diary data on-device.
- **Working as demo only (mocked):** recipe import (URL/photo/text/manual), AI coach/chat/generator/substitutions, social/discover, household, paywall, onboarding/auth, notifications.
- **Architecturally possible but absent:** real accounts + cloud sync (Supabase project already exists), HealthKit via the existing Capacitor shell, push notifications, real IAP.
- **Expressly out of scope in code:** calendar/appointments (nothing beyond the meal-plan week), wearable device import.

## 2. Data capacity

| Limit | Type | Value / finding |
|---|---|---|
| App bundle | Measured | 2,627,516 bytes single HTML file (2.63 MB); loads all screens/assets upfront |
| Recipes | Configured (fixture) | 27 built-in + 1 scanned slot (id 999, not persisted) |
| Diary entries | Unbounded array | `dlog` grows without pagination; every diary render filters the whole array — fine for months of use, no archival path |
| Health logs | Fixed-size | sleepLog/stepsLog are 6-slot arrays + today (by design); bpLog/wextra unbounded, no pruning |
| Persistence | Inferred | Whole whitelisted state JSON-serialized per debounced setState into one localStorage key; localStorage cap ~5 MB → thousands of entries OK, but a single oversized write fails silently (no quota error handling — untested, listed as gap) |
| Scan image | Configured | Client downscales capture to 900 px JPEG before upload |
| AI backend | Unknown | No rate/quota limits configured on the edge function (DEF-005); Anthropic-side limits unmeasured |

## 3. Measured performance (this audit, desktop Chromium, local server)
- Boot to interactive: sub-second locally after transfer; the 2.63 MB file is the dominant cost on mobile networks — a loading screen exists specifically because of the white-screen gap observed on phones.
- Scan round-trip (live, real image): **5.9 s** (server 502 rejection path: 0.77 s). Client shows an analyzing screen throughout; acceptable UX.
- Filter/diary interactions: instant (all client-side, single-frame re-render of one screen subtree).
- Full 884-control crawl completed in ~90 s including waits — no interaction produced visible jank.
- Memory: not soak-tested (gap). One 2 MB string kept in memory (scanImg base64) per scanned recipe.

## 4. Scalability risks
- Single-file architecture is the deliberate design and its own cap: every feature grows one file (currently ~232 KB source, 2.63 MB built) and one render class; there is no code splitting.
- Unbounded arrays noted above (dlog, bpLog, wextra) — add pruning/pagination before long-term real use.
- Every persisted mutation rewrites the entire state JSON (debounced) — fine at current sizes; will degrade with thousands of diary entries.
- No caching/CDN concerns: GitHub Pages serves the static file with sane caching; scan endpoint is the only dynamic dependency.
- Recommended (provisional) targets, labeled as recommendations: <1 s filter feedback (met), <10 s scan p95 (met at n=1; needs measurement at p95), <3 s first paint on 4G (unmeasured — test with throttling).
