# Remediation Roadmap — 21

No calendar estimates; ordered by priority within phases. Gates refer to PRODUCTION-READINESS gates in the main report §T.

## Phase 0 — Immediate safety & integrity
| ID | Item | Reason / risk | Acceptance criteria | Tests | Prio | Size | Gate |
|---|---|---|---|---|---|---|---|
| P0-1 | Rotate the API key that appeared in an earlier session's error output | Credential hygiene (DEF-005) | Old key invalid; app still scans | SCN-05 live smoke | P0 | S | 5 |
| P0-2 | Rate-limit / abuse-protect the scan edge function | Unmetered paid AI endpoint behind a public anon key | >N req/min per IP rejected with 429; legit flow unaffected | SEC-01 | P0 | M | 5 |
| P0-3 | Remove "Synced from Apple Health" fiction (DEF-007) | Misleading health-data provenance | Caption gone or replaced with truthful text | SMK-01 snapshot | P1 | S | 2,5 |

## Phase 1 — Core-path stabilisation
| ID | Item | Acceptance criteria | Prio | Size | Gate |
|---|---|---|---|---|---|
| P1-1 | Fix DEF-001: search composes with dietary filters; show active-filter pills on search | FCR-06 passes | P1 | S | 3 |
| P1-2 | Persist scanned recipes (DEF-006) | Recipe survives reload | P2 | S | 2 |
| P1-3 | Guard stale-object toggles (DEF-002, `obj?.on`) | Crawl double-tap pass clean | P2 | S | 2 |
| P1-4 | Water tile wording or behavior (DEF-004) | Label matches behavior | P3 | S | 2 |
| P1-5 | Strip `.image-slots.state.json` fetch from prod build (DEF-003) | Clean boot console | P3 | S | 1 |
| P1-6 | Decide + implement OQ-2 (persist view selections or not) | Documented behavior + PER-02 | P3 | S | 2 |

## Phase 2 — Test coverage & reliability
- P2-1 Add `data-testid` emission to `btn()/chip()/field()` helpers (S) — prerequisite for all automation.
- P2-2 Playwright Suites 1–2 (smoke + math) running in GitHub Actions on the built file; failure blocks Pages deploy (M). Gate 7.
- P2-3 Scan contract suite with recorded fixtures (M). Gate 7.
- P2-4 WebKit matrix run (S). Persistence/corruption tests PER-01..05 (S).

## Phase 3 — Security, privacy & accessibility
- P3-1 Privacy disclosure for scan photos (photos leave device → Anthropic via Supabase) + consent moment before first scan (M). Gate 5.
- P3-2 Legal review of terms/paywall copy; hide paywall until IAP is real (S/M). Gate 5.
- P3-3 Accessibility retrofit at helper level: real `<button>`s, focus styles, labels, chart text alternatives (L). Gate 6.
- P3-4 Document scan_debug retention; add auto-purge (S).

## Phase 4 — Performance & scale
- P4-1 Measure first-paint on throttled 4G; consider gzip/br pre-compression of the single file (S).
- P4-2 Prune/paginate unbounded arrays (dlog, bpLog, wextra) (M).
- P4-3 Quota-failure handling for localStorage writes (S).
- P4-4 Soak test cooking timers + repeated scans (M).

## Phase 5 — Product completion (decisions first — see OPEN_QUESTIONS)
- P5-1 Real accounts + cloud sync (Supabase auth + tables) — prerequisite for any multi-device story (XL).
- P5-2 Real recipe import, or clearly label demo (M/XL).
- P5-3 Real AI coach/chat via existing backend pattern, or remove (M).
- P5-4 HealthKit/Health Connect via Capacitor (L). P5-5 Real IAP (L). P5-6 Notifications (M).
- P5-7 Capacitor iOS build + TestFlight pass (M). Gate 1.
