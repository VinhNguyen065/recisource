# Test Coverage and Gaps — 21 (2026-08-09)

## What is covered (by this audit's scripted-manual passes + prior same-day evidence)

| Area | Coverage | Confidence |
|---|---|---|
| All 55 screens render without error | Full (crawl) | High |
| All 884 clickable controls respond | Full click pass (crawl) | High |
| Calorie diary math (day filter, steppers, delete, rapid-tap) | Deterministic fixture math | High |
| Cross-screen sync (diary ↔ Today dashboard, kcal ring) | Spot-verified exactly | High |
| Health metrics (weight, steps, sleep formula, HR/BP) | Deterministic checks | High |
| Library + dietary filter combination accuracy | Exact subset verification | High |
| Search query accuracy | Exact subset verification | High |
| Persistence whitelist behavior across reload | Fresh-context reload test | High |
| Scan backend calories mode (live) + error path | curl + in-app | High |
| Scan barcode/recipe modes | Prior same-day E2E only | Medium |
| Mobile viewport, phone camera capture | Prior same-day, user-confirmed | Medium |

## What has never been tested anywhere
1. **iOS/Android Capacitor build** (CAP-33) — `npx cap sync/open` has never been run; App Store readiness is untested end-to-end.
2. **kcal slider drag** (FLT-07) and multi-allergen combination math (FLT-08 partial).
3. Concurrent multi-tab behavior (two tabs share one localStorage key with last-write-wins debounce — untested, plausible data loss).
4. localStorage quota exhaustion / corrupted-JSON recovery (boot try/catch exists but never exercised with corrupt payloads).
5. Long-run soak (memory growth over hours; timers in cooking mode).
6. Screen-reader output (no ARIA exists to test — see accessibility review).
7. Edge-function behavior under concurrency/rate abuse.
8. Browser matrix (only Chromium tested; Safari/WebKit is the actual iOS engine — **important gap** given Capacitor target).

## Structural gaps
- **Zero automated tests exist.** Nothing is repeatable without re-scripting; regressions are currently detected only by manual passes.
- **No CI.** Nothing gates the GitHub Pages deploy; a bad build ships silently.
- **No stable selectors/test IDs** — the single-file dc-runtime emits positional divs, which makes future E2E automation brittle unless test IDs are added at build time.
- **No unit-testable module boundaries** — all logic lives in one class in one file; formulas (sleep score, macros, filters) cannot be imported in isolation. Extracting `filtered()`, `searchResults()`, the sleep-score fn and diary totals into a testable module would unlock cheap unit coverage.

## Priority order for closing gaps (feeds FULL_TEST_PLAN.md)
1. Playwright smoke suite against the built file (boot, tab nav, diary math, filter math) — protects the deploy.
2. DEF-001 regression test (search × filters).
3. Scan contract test with recorded fixtures for all 3 modes (mock at fetch boundary; one live smoke kept manual).
4. WebKit run of the same suite (iOS engine risk).
5. Persistence property tests (whitelist keys round-trip; corrupt-JSON boot).
6. Capacitor build verification job.
