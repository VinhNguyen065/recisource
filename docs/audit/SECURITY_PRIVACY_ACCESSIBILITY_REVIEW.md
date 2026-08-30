# Security, Privacy & Accessibility Review — 21 (2026-08-09)

## 1. Security

### Confirmed issues
- **DEF-005 (P1): unmetered AI endpoint + key hygiene.** The Supabase anon key ships in the client (normal for Supabase), but `functions/v1/scan` invokes a paid Anthropic model per call with **no rate limiting, no origin allow-list, no size cap beyond model limits**. Anyone extracting the key (trivially, from the public Pages build) can burn quota/cost. Additionally, an API key appeared in an error output during an earlier session today — **rotate the affected key before wider distribution**.
- **No authentication exists** (CAP-02): every device is anonymous; there is no server-side user data, so there is no cross-user exposure surface today — but also no account security to assess. The auth screen is a visual shell.

### Risks (not presently exploitable)
- Health data (BP, conditions, medications, weight, sleep) is stored **unencrypted in localStorage** under `recisource_v1`. On a shared device, any browser user or any JS injected into the origin can read it. Acceptable for a prototype; not for beta with real users' medical data.
- The data export writes an unencrypted JSON file including conditions/medications — appropriate to warn the user at export time.
- `scan_debug` table logs scan errors server-side (RLS service-role-only — verified in prior session; debugging photo storage was removed and wiped). Retention policy undocumented.
- No CSP headers on GitHub Pages hosting; the single file inlines everything, which limits but does not eliminate XSS surface (recipe-scan responses are parsed and rendered — a hostile model output could inject strings; React text rendering escapes by default, which mitigates).
- Terms/paywall promise subscriptions ($39.99/yr) with no billing infrastructure — a legal/compliance risk if shown to real customers as-is.

### Non-issues verified
- No secrets in the repo beyond the intentionally-public anon key (searched for key/token/secret patterns; the service-role key is not present in any audited file).
- User-to-user isolation: n/a by architecture (no server-side user data).
- Injection: search input round-trips through React text nodes only; typed `<script>` in search/query fields renders as text (React escaping), verified by code path — no `dangerouslySetInnerHTML` use with user input (one `dangerouslySetInnerHTML` reserved-prop exists in the `e()` helper but no user-data call site).

## 2. Privacy
- All health data is device-local. Nothing is transmitted except scan photos (user-initiated) to the Supabase edge function → Anthropic. This is a genuinely strong privacy posture for a prototype, with two caveats:
  1. The **"Synced from Apple Health"** caption (DEF-007) falsely implies an integration and should be removed.
  2. There is **no privacy policy document** describing the scan-photo flow; the legal screen has wellness disclaimers but does not disclose that photos leave the device. Required before beta.
- Data deletion: clearing browser storage deletes everything (no server copies except transient scan processing + error logs). Export exists (CAP-29). No consent flow exists for the AI photo processing.

## 3. Accessibility (WCAG 2.2 AA target)

### Systemic failures (affect every screen)
- **Keyboard: FAIL.** Interactive elements are `div`s with `onClick` — no `tabindex`, no roles, no focus styles. Nothing except the few real `<input>`/`<button>` elements is keyboard-operable. This is the single largest accessibility defect and is architectural.
- **Screen reader: FAIL.** No ARIA labels/roles/landmarks; icons are unlabeled SVGs; charts are purely visual (weight chart, sleep/steps bars) with no text alternative beyond the selected-value readouts (which do help).
- **Focus management: FAIL.** Sheets/modals do not trap or restore focus; Escape does not close.

### Passes / partials
- Color contrast: primary text (#17191D on #FBFBF9) passes AA comfortably; muted grey (#83868C) on white is borderline (~3.9:1) for small text — review.
- Status not by color alone: mostly OK (labels accompany states, e.g. water count text, selected chips get weight/fill changes).
- Touch targets: most are ≥38 px; the diary `×` delete and stepper buttons are near the 24-px floor — enlarge.
- Text scaling: layout is fixed-px inside a phone frame; browser zoom works, in-app text scaling not supported.
- Reduced motion: animations are minor; no `prefers-reduced-motion` handling.
- Dark mode exists and is user-controllable (appearance setting) — verified in prior session.

### Practical recommendation
Retrofitting full AA onto the dc-runtime div-based renderer is significant work. Minimum credible path for beta: make `btn()`/`chip()`/`circBtn()` emit real `<button>` elements with `aria-pressed`/labels (single helper-level change propagates app-wide), add focus styles, label the inputs and the kcal slider, and provide text summaries for charts.
