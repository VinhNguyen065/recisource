# Full Test Plan — 21

Goal: convert today's scripted-manual verification into a repeatable automated programme. Recommended framework: **Playwright** (no test framework exists to prefer; the app is a static file, Playwright covers Chromium + WebKit — WebKit matters because iOS/Capacitor uses it). Add build-time `data-testid` attributes to the `btn()/chip()/field()` helpers first; positional selectors will not survive edits.

Principles applied: deterministic fixtures (the app's demo state IS the fixture — reset by clearing `recisource_v1`); freeze time where day-dependent (diary defaults to Friday index 4 — inject a fixed Date); no sleeps (wait for text/state); screenshots on failure; suites split smoke/regression/full; all runnable in CI on the built file with no server except a static host; scan tests mock `fetch` at the boundary with recorded responses, plus one manual live smoke.

## Suite 1 — Smoke (gates every deploy, <2 min)
| ID | Test | Expected |
|---|---|---|
| SMK-01 | Boot to Today screen, loader clears | Title "21", no console errors except none (DEF-003 fixed) |
| SMK-02 | Tab bar: all 8 tabs navigate | Each target screen renders |
| SMK-03 | Diary shows Food 1140 on default fixture | Exact |
| SMK-04 | Log stepper +25 | Total 1165; Today ring updates |
| SMK-05 | Persistence: reload keeps water/dlog | Exact round-trip |

## Suite 2 — Filter & calculation regression (the math suite)
- FCR-01 Diary day chips: per-day totals for a 3-day synthetic dlog (independent sums).
- FCR-02 Delete demo meal → totals − item kcal; dashboard sync; persists.
- FCR-03 Rapid-tap: N programmatic clicks = exactly N×25.
- FCR-04 Library filters: each dimension alone (meal, diff, rating, maxTime, maxKcal slider, diet, allergens) vs independently computed subsets over the 27-recipe fixture.
- FCR-05 Combined 2-filter and 3-filter subsets; order independence; removal of one filter.
- FCR-06 **DEF-001 regression:** search with active filters returns filtered∩query set once fixed.
- FCR-07 Search: case, partial, multi-word, no-result, clear-×; injection strings render inert.
- FCR-08 Sleep score: table of mins→score incl. clamps (40/100 boundaries: 120 min→40, 480→100).
- FCR-09 Steps %: values around goal boundary (9 999/10 000/10 001), goal edit recompute.
- FCR-10 Weight ranges W/M/6M chart series lengths + goal-line value.
- FCR-11 Water: tap cup N → level N; dashboard tile mirrors.
- FCR-12 Reset filters restores documented defaults; count badge = 27.

## Suite 3 — Scan contract suite (fetch mocked; fixtures recorded from live function 2026-08-09)
- SCN-01 calories 200 → mealScanResult items/portions render; Log writes dlog with day index.
- SCN-02 barcode 200 → same path. SCN-03 recipe 200 (incl. ```json fenced) → recipe id 999 detail, cook mode.
- SCN-04 502/timeout/malformed JSON → clean pop + toast, no crash, no dlog write.
- SCN-05 (manual, live) one real calories POST — matches contract shape.

## Suite 4 — Persistence & resilience
- PER-01 Whitelist round-trip: every persisted key survives reload (parameterized list).
- PER-02 Non-whitelist state resets (documents OQ-2 decision once made).
- PER-03 Corrupt `recisource_v1` JSON → app boots on defaults (try/catch path).
- PER-04 Two-tab last-write-wins characterization.
- PER-05 Quota exhaustion: oversized state → defined behavior (currently unknown).

## Suite 5 — Mobile/responsive (Playwright device profiles + WebKit)
- MOB-01 ≤520 px: full-screen app, no topbar, footer buttons on-screen for all 26 wrapped screens.
- MOB-02 Loading screen appears on throttled 4G and clears.
- MOB-03 WebKit engine run of Suites 1–2 (iOS proxy).

## Suite 6 — Accessibility (after helper retrofit)
- A11Y-01 axe-core scan per screen: zero critical.
- A11Y-02 Keyboard path: tab through diary → log → delete.
- A11Y-03 Contrast tokens (muted grey) pass AA.

## Suite 7 — Security regression
- SEC-01 Scan endpoint rejects >N req/min (after rate-limit fix, DEF-005).
- SEC-02 No secrets in built file (pattern scan in CI).
- SEC-03 Search/name inputs with HTML/script payloads render as text.

## Manual programme (per release)
Phone pass on real iOS Safari + Android Chrome via Pages URL: camera capture each scan mode, one full cook-through, export download opens, dark mode, offline behavior note.

## Missing-test backlog (priority, complexity)
| Test | Risk protected | Prio | Size |
|---|---|---|---|
| FCR-06 DEF-001 regression | Silent wrong results | P1 | S |
| SMK suite in CI on Pages deploy | Broken prod ships | P1 | M |
| SCN-01..04 contract suite | Core feature regressions | P1 | M |
| WebKit run | iOS breakage unseen | P2 | S |
| PER-03/05 corruption/quota | Data loss | P2 | S |
| A11y retrofit + axe | Beta inclusivity/store review | P2 | L |
| Soak/memory (cooking timers, repeated scans) | Long-session crashes | P3 | M |
