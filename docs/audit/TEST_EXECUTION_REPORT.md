# Test Execution Report — 21 (2026-08-09)

## Environment
- OS: Windows 11 Home 10.0.26200; shells: PowerShell 5.1 + Git Bash.
- Runtime under test: single-file HTML/React app `app-store-package/www/index.html` (2.63 MB, React 18 UMD inlined).
- Served: `http://localhost:8321` via PowerShell HttpListener (evidence: scratchpad `serve.ps1`); also loaded once from `file://` (initial rename check + crawl).
- Browser: Claude Browser pane (Chromium).
- No Node.js, no Python, no package-manager toolchain exists for the frontend (deliberate single-file architecture). `app-store-package/package.json` contains only Capacitor packaging scripts (`ios:add`, `ios:sync`, `ios:open`) — no `test`, `build`, or `lint` scripts exist anywhere in the repository.
- Version control: the working folder is **not** a git repository. The deployable copy lives in a git clone (GitHub `VinhNguyen065/recisource`, branch `main`); baseline commit at audit start: `7938d34`, clean tree; rename committed as `0f6c9d9` during this session (unpushed — push is owner-run by policy).

## Automated test suites in the repository
**None exist.** Zero test files, zero test configuration, zero CI workflows were found (searched for `*.test.*`, `*.spec.*`, jest/vitest/playwright/cypress configs, `.github/workflows`). Consequently:
- Tests passed prior to this audit: none (none exist).
- Tests failed: none (none exist).
- Tests skipped/focused/stale: none (none exist).
- CI: none configured; no CI evidence available.

All verification below is scripted-manual testing performed through the running application during this audit, plus recorded prior-session evidence from earlier the same day (2026-08-09).

## Commands and checks executed this audit

| # | Command / action | Working dir | Exit/Result | Classification |
|---|---|---|---|---|
| 1 | `git status` (working folder) | project root | exit 128 — "not a git repository" | Environmental fact, recorded |
| 2 | `git status` / `git log` (pages-repo) | pages-repo | clean; `7938d34` | PASS (baseline) |
| 3 | Static serve + full app boot | localhost:8321 | App boots; loader clears; no console errors except DEF-003 404 | PASS |
| 4 | Rename runtime verification (T16) | Browser | All strings "21"; zero old-name hits | PASS |
| 5 | 55-screen / 884-control click-crawl | Browser | 55/55 screens render; 2 race-condition errors in 884 clicks (DEF-002); replay clean | PASS with note |
| 6 | Filter/data battery T1–T13 (13 scripted tests) | Browser | 12 PASS, 1 FAIL (T12 → DEF-001) | See evidence file |
| 7 | Scan failure path T14 (blank image through real pipeline) | Browser | Clean pop-back, no crash | PASS |
| 8 | `curl POST /functions/v1/scan` blank PNG | shell | HTTP 502 structured error, 0.77 s | PASS (correct rejection) |
| 9 | `curl POST /functions/v1/scan` real JPEG calories | shell | HTTP 200, correct food recognition, 5.9 s | PASS |

Full raw outputs: `docs/audit/evidence/filter-and-data-tests-2026-08-09.md` and `evidence/crawl-results-2026-08-09.json`.

## Prior-session evidence accepted (same day, 2026-08-09, recorded in session memory/git history)
These were verified earlier today in equivalent conditions but not re-run in this audit pass; confidence Medium:
- Barcode scan mode (curl + on-phone), recipe scan mode E2E including cooking-mode entry.
- On-phone (GitHub Pages origin) scan CORS + camera capture + log-to-diary flow (user-confirmed live).
- Settings export producing a real JSON download; dark mode; grocery flows; medical profile editors.
- Mobile viewport behavior (≤520 px full-screen mode, footer buttons on-screen, loading screen).

## Test-quality caveats
- All fresh UI tests drove real React event handlers (element.click() / onChange) — not internal method calls — except two explicitly-flagged fixture injections (a dlog entry, and jump() navigation which mirrors the real nav handler).
- Expected values were computed independently from fixture data before comparison (sums, formula, subset membership) — not by reading the UI back.
- No test executed against real personal data; all data was the app's built-in demo fixture plus synthetic entries.
