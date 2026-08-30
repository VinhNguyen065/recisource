# Open Questions & Required Decisions — 21 (2026-08-09)

Decisions only the owner can make; nothing here blocked the audit.

**OQ-1 — Product identity.** The app is renamed to "21" everywhere user-visible. Three identifiers were deliberately left: the localStorage key `recisource_v1` (changing it wipes every existing user's data — a migration shim could rename it safely if desired), the iOS bundle id `com.recisource.app` (changing later orphans any TestFlight installs; also `com.21.app` is not a valid reverse-DNS segment — something like `com.vinhnguyen.twentyone` would be needed), and the GitHub Pages URL `/recisource/` (changing the repo name breaks the QR card + any shared links). Decide whether any of these should follow the rename.

**OQ-2 — Should view selections persist?** Data (diary, health logs, goals) persists across restarts; view state (dietary filters, plan view, weight range, selected day bars) resets by design of the whitelist. Both behaviors are defensible; confirm intent so PER-02 can assert it.

**OQ-3 — Demo features: build or label?** Recipe import, AI coach/chat/generator, discover/social, household, paywall and onboarding/auth are convincing visual demos with no backing implementation. For beta testers this reads as "broken" unless either (a) implemented, or (b) visibly badged as preview. Which features are in the real product's v1 scope?

**OQ-4 — Paywall pricing copy.** "$39.99/year or $5.99/month" is shown with no billing. Keep for prototype storytelling, or hide until IAP exists (legal exposure if real users see it)?

**OQ-5 — Scan photo privacy disclosure.** Photos leave the device (Supabase → Anthropic). Approve adding a first-scan consent note + privacy text? (Currently nothing discloses this.)

**OQ-6 — Which key appeared in the earlier error output, and has it been rotated?** The audit records the exposure event from earlier sessions today but cannot verify rotation status from the repo. Please confirm so DEF-005 can be partially closed.

**OQ-7 — Calendar scope.** The brief for this audit assumed calendar/appointment features; none exist in the code (only the meal-plan week). Is a calendar planned, or out of scope?

**OQ-8 — Store submission intent.** The Capacitor package has never been built. Is App Store delivery still the goal (drives P5-7, HealthKit, IAP priorities), or is the PWA/Pages distribution the product for now?

**OQ-9 — Multi-device/cloud sync.** All data is device-local; losing the phone loses the data. Acceptable for beta, or is Supabase-backed sync (and therefore real accounts) required first?
