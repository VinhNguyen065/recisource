# Evidence log — feature build + full retest (2026-08-09, late evening)

Build under test: fresh `build.ps1` output (2,634,398 bytes) from the updated `Thermal Kitchen.dc.html`, served at http://localhost:8321, clean localStorage. Pages-repo commit `4a2c6b2`. Screens now 57 (adds `manualFood`, `planPick`).

## New features verified (all through real UI event handlers)

### F1 — Manual food entry in the calorie diary (PASS)
- Empty slots render two dashed buttons: "Scan <slot>" + "Add manually" (`{"dinnerButtons":true}`).
- "Add manually" on Dinner → manualFood sheet with Dinner preselected; name typed, 400-kcal quick chip + one `+25` stepper → field "425"; Add to diary → returns to diary; row rendered; Food total **1565 = 1140+425** exact. dlog entry `{"day":4,"n":"Grilled salmon & veg","kcal":425,"slot":"Dinner"}`.
- Slot-header "+" (present on all 4 slots incl. non-empty): Breakfast preselected; typed kcal "105" (Banana) → total **1670**; Breakfast section holds it.
- Dashboard sync: healthToday Eaten **1670**; meal rows labeled with their true slots ("Breakfast / Banana · logged just now", "Dinner / Grilled salmon & veg…").
- Validation: empty name → toast, no dlog write; name without kcal → toast, no write (dlog length unchanged both times).
- Kcal input strips non-digits, caps 4 digits; steppers clamp 0–2000.

### F2 — Scan preselects the tapped meal slot (PASS)
- Mon (all slots empty) → tap "Scan breakfast" → `state.mealSlot='Breakfast'`, camera screen opens. Log after a (mocked-network) calories scan writes `slot:"Breakfast", day:<selected day>` — entry landed as `{"n":"Scanned: Oatmeal with berries","kcal":320,"day":4,"slot":"Breakfast"}` and diary shows it under Breakfast.

### F3 — Scanned recipe: saved, cookable, plannable, persistent (PASS)
- Recipe pipeline driven through the real `runScan('recipe')` with fetch mocked at the network boundary (realistic 3-ingredient/3-step payload): lands on recipeDetail with title, ingredients, numbered method; "Recipe scanned & saved to library" toast; `state.scanRec` set; RECIPES contains id 999.
- Start Cooking → cookStep shows step 1 ("Sauté aromatics"). 
- **Reload test:** after debounced save + hard reload — recipe still in library with full ingredients/steps (`recipePersisted:true, recipeLive steps=3, detailOk:true`). DEF-006 CLOSED.
- **Live backend recipe mode re-verified by curl** with a real food JPEG: full structured recipe returned (Butter Chicken; 8 ingredients; Thermomix-style steps with temp/time/speed). Calories mode live-verified earlier same day.

### F4 — Add to meal plan actually works (PASS)
- recipeDetail "Plan" action → new planPick sheet (recipe card, 7 day chips, 4 slot chips). Thu + Lunch + "Add to plan" → `planX={"0-3-Lunch":999}`, meal plan opens on Thu showing the recipe in Lunch; tapping it opens the recipe; Start Cooking works.
- Meal-plan empty slot "Add meal" → addMeal sheet now has working Day + Meal-time selectors (context defaults to the tapped slot: Wed/Dinner). Switched to Sat + Breakfast, tapped a recipe → `planX["0-5-Breakfast"]=1`, plan shows it on Sat breakfast.
- **planX persists across reload** (`{"0-3-Lunch":999}` intact; slot still rendered after fresh boot).

### F5 — DEF-001 fix: search respects the dietary filter sheet (PASS)
- Breakfast+Easy active → search browse shows exactly the 3 matching recipes (independently computed), all excluded titles absent, active-filter pills rendered.
- Query ∩ filters: "dosa" → only "Cheese Dosa" (Masala Dosa correctly excluded by filters); "chicken" → correct "No recipes found" empty state.
- Reset chip restores defaults; search base back to 27 ("BROWSE ALL 27" visually confirmed).
- Regression: library segment chips still work post-refactor (Favorites → exactly the 4 favorited titles).

## Regression sweep (PASS)
- Diary day filter with new data: Fri = **1990 = 1140+425+105+320** exact; Mon = 0.
- Water cups: tap cup 6 → water=6.
- Scan failure path (network reject): clean pop back, no crash.
- Click-crawl of the 2 new screens: 15 + 16 controls, zero errors.
- Console: only the known boot 404 (DEF-003) and the deliberate test 502 — no new errors.

## Not testable in this environment
- Physical camera capture (file input → native camera) — wiring unchanged and previously phone-verified; **recommend a quick phone re-test after push**: scan a recipe photo, confirm the recipe survives an app reload, and add it to a plan slot.

## Defect register updates
- DEF-001 (search ignores filters): **FIXED** this session, regression-tested.
- DEF-006 (scanned recipe lost on reload): **FIXED** this session, reload-tested.
- New known limitation: plan overrides are keyed per week/day/slot; only the current demo week (wk 0) is targeted by planPick (addMeal honors whichever week is open). Removal UI for a planned override is the swap button (replaces) — no explicit "clear slot" control yet.

---

# Addendum — scan-flow rework retest (2026-08-24)

Build: 2,638,342 bytes from updated source; served localhost:8321; clean state. All driven through real UI handlers; network mocked at the fetch boundary except where noted.

## New scan-flow features verified
- **Entry presets (PASS):** Today's "Scan your meal" card → scanner in Calories mode; diary scan button and slot buttons → Calories (+ slot preset); add menu's new "Scan a recipe" entry → Recipe mode.
- **Scanner UI (PASS):** fake Flash/Photo-library/Describe toast-buttons removed; real **Gallery** button (file picker without forced camera capture) and **Manual** button (calories → manual food sheet, recipe → manual recipe entry); "Logging to Fri · Breakfast" context pill renders in Calories mode and cycles the slot on tap.
- **Analyzing screen (PASS):** mode-aware titles ("Analyzing your meal…" / "Reading the recipe…" / "Reading the label…"); visible Cancel button.
- **Cancel race guard (PASS):** scan cancelled mid-flight; a delayed (900 ms) response arrived afterwards and was fully ignored — no screen hijack, no phantom items (`lateIgnored:true`).
- **Cross-mode, same photo (PASS):** calories result → "Cooked dish or cookbook page?" → full recipe from the same image (mocked payload) → recipeDetail with banner; banner's **Count kcal** → calories result from the same image. Both directions verified.
- **Log-anywhere (PASS):** Log action on recipe detail prefills the manual food sheet (name + kcal) → one diary entry `{day:4,n:'Seafood Paella',kcal:480,slot:'Dinner'}`; cookComplete's "Log this meal to my diary" prefills the same sheet.
- **Result screen (PASS):** "Add a missed item manually" opens the manual food sheet with the scan's slot.

## Regressions (PASS)
Diary math with the logged recipe: Fri Food 1620 = 1140 + 480 exact. Filter sheet count (Breakfast=4) equals search result count (4) — search×filters fix intact; Reset → 28 (27 + persisted scanned recipe).

## Repo note
The prior session's scratchpad was cleaned up between sessions, destroying the old pages-repo clone including its two unpushed commits (0f6c9d9 rename, 4a2c6b2 features). No content was lost — the working files contain everything. A fresh clone was made and all changes committed as **`9f89d12`** on top of origin's `7938d34`. The build pipeline (build.ps1 + recovered React bundles) was reconstructed in the current session scratchpad.

---

# Addendum 2 — photo-first scanning + real imports (2026-08-24/25, commit 61eac88)

All verified E2E on clean fixtures at localhost (backend mocked at fetch boundary — Supabase project is PAUSED, see blocker below):
- Photo-first scanner: one shutter, no Barcode chip; capture → "What is this?" choice screen (Count calories / Save as recipe / Retake). Calories path → result with **day chips + slot chips** → logged exactly {day:1 Tue, slot:Lunch, 410 kcal}, diary opens on Tue. Recipe path → recipeDetail.
- Add menu simplified to 4 working entries. Link import: empty input blocked; "youtube.com/…" auto-prefixed to https and sent as {mode:'url'}; success → recipe id 1000 in persisted myRecs; no_recipe error → toast, stays on screen, phase reset. Text import → id 1001. Manual creation → id 1002 with parseIng("2 kg beef bones")→{q:2,u:'kg',item:'beef bones'}; validation (no title/ingredients/steps) blocks; Edit recipe prefills and updates in place (no dupe). All three recipes + ingredients/steps survive hard reload.
- Manual food sheet day chips: entry landed {day:2 Wed, Lunch, 250}.
- More-like-this row on recipeDetail navigates between recipes (130px cards). Fictional Apple Health caption replaced with honest text.
- Crawl of 7 changed screens: zero uncaught JS errors (console shows only test-image ERR_INVALID_URL noise, known 404, and paused-backend fetch failures handled by toasts).

## BLOCKER (open)
Supabase project czbetvehfqqfhggqlqfp is **INACTIVE (auto-paused)**; scan endpoint returns no connection. Edge function **v17** (adds url + text import modes, sharper calories-portion prompt) is written in app-store-package/backend/scan/index.ts and ready to deploy; restore was denied to the agent by the permission classifier — owner must restore via Supabase dashboard, then deploy v17. Until then, phone scanning and link/text import fail with clean error toasts.

---

# Addendum 3 — data-sync audit round (2026-08-29, commit 77d3760)

Cross-page synchronization audit: every shared number traced from source state to every screen that shows it; fixes verified with exact math on clean fixtures.

## Fixed this round (all E2E-verified)
- **Calorie goal was hardcoded 1900 in two places** (Today ring, diary) with no editor → now persisted `kcalGoal` + goalEdit sheet (steppers/quick chips, tap the dotted "Goal N" in the diary). Verified: 1900→2200 via UI → diary "Goal 2200", Today ring "1480 left / 2200 kcal", macro targets recompute to 110/73/275g (20/30/50 split of goal). Survives reload.
- **Macro bars were fake** (proportional scaling of demo totals) → now true sums: scan logs store the scan's real p/f/c (verified 35/20/40 stored and summed: 99/58/172), manual entries estimate from kcal, demo meals carry fixed macros summing to the original 64/38/132 (no visual regression on fresh state).
- **Deleting an imported/scanned recipe didn't stick** (only removed from the in-memory array; reappeared after reload) → delete now also updates persisted myRecs/scanRec and removes any meal-plan slots pointing at it. Verified: import → plan → delete → planX `{}` → reload → still gone.
- **No way to clear a filled meal-plan slot** → filled slots now show a × (verified: add Thu lunch → × → override removed, suggestion returns).
- **Healthy-days tile navigated to the weight screen** → now opens the fitness hub.
- goalEdit screen crawl: 12 controls, 0 errors. 59 screens total.

## Verified already-synced (no change needed)
Nutrition screen derives from the recipe's macros; grocery has add + remove (user items deletable, demo staples check-off); water/steps/sleep/HR/weight tiles all read live state (prior rounds); dashboard "Today's meals" mirrors diary incl. slots.

## iOS without a Mac
`app-store-package/` + `.github/workflows/ios-build.yml` committed to the repo: a manual GitHub Actions job on GitHub's free cloud macOS runners that generates the Capacitor iOS project, injects the HealthKit entitlement + Info.plist usage strings, runs an unsigned compile check, and uploads the ready-to-sign Xcode project artifact. Signed TestFlight route documented via codemagic.io (free tier) once an Apple Developer account exists. The workflow is authored but has not yet run — first run pending the owner clicking "Run workflow" (needs Actions enabled on the repo).

---

# Addendum 4 — demo screens removed for beta (2026-08-29, commit 43f63db)

Removed (unreachable + delisted from gallery/registries): discover, publicProfile, publicRecipe, household, paywall, autoGenerate, mealTemplates, aiGenerator, aiSubstitutions, aiAutoTag, aiCoach, shareSheet. 59 → **47 screens**.

Rewired instead of deleted cold (all verified):
- Share (recipe actions, more menu, cook complete) → native `navigator.share` with clipboard fallback (verified payload "Chicken Fried Rice · 21", stays on page).
- 'Swaps' chip → live AI chat pre-asks substitutions for that recipe; library "What can I make tonight?" card, Today assistant card, and medical-profile button all → live chat. Fake "plan is ready" claim removed.
- Profile: Pro upsell card deleted; menu rows pruned to real destinations. Settings: Household row removed. Meal plan: only the working "Add all to list" remains. Library header no longer fake-switches households.

Full crawl after removal: **47 screens, 781 controls, 0 errors**. Prior audit batteries (goal sync, macros, imports, scan flow) unaffected. Dead case blocks remain in source (unreachable; ~30 KB in a 2.6 MB file) — noted for future code cleanup, invisible to users.

---

# Addendum 5 — real accounts & cloud sync (2026-08-29, commit 4c780dc)

Backend: `user_state` table (jsonb blob per user, RLS all four ops scoped to auth.uid(), touch trigger) via migration `user_state_sync`; edge function v19 adds `mode:'signup'` (admin API, email_confirm:true — bypasses the unusable built-in email rate limit; project's confirm-email setting untouched). Client: fetch-based GoTrue auth (password grant + refresh), snapshotState() shared by localStorage + cloud, debounced cloudPush 2.5s after each save, reconcile-on-login.

## Live E2E (real Supabase, real accounts, synthetic emails; test users deleted after)
- Signup → instant session → auto-push. Server row verified by SQL: kcalGoal 2100, 1 diary entry.
- **Sync bug found & fixed during testing:** a fresh device saved defaults with a new `_ts` and clobbered the cloud before pulling (classic LWW trap). Fix: `recisource_acct` device marker — a device that never synced the account takes the cloud copy unconditionally; returning devices reconcile by `_ts`; and `_syncReady` gate blocks any push until the first reconcile completes. Re-test: wiped device → login → full restore (goal 2100, water 6, "Sync test meal", diary Food 1473 = 1140+333 exact).
- Device-2 edit (water→3) round-tripped to the cloud row (SQL-verified).
- Logout clears the session, keeps local data.
- **Isolation:** second account signs up → sees zero of account 1's data; direct REST probe using account 2's token against account 1's row → empty array (RLS enforced at API level). SQL shows two separate rows.
- Auth/profile/settings crawl: 37 controls, zero errors. Fake Apple/Google buttons removed; settings Password row sends a real reset email.

## Notes / limits
- Sync granularity is whole-blob LWW — simultaneous edits on two devices within the same window: newest snapshot wins (fine for single-user personal data; item-level merge is a future refinement).
- Account deletion flow not yet built (owner can delete via dashboard; add an in-app delete + data purge before public release).
- Password reset email uses Supabase's built-in sender (very low rate limit) — configure custom SMTP before a bigger beta.

---

# Addendum 6 — fitness ultra round: workouts, stopwatch & timer (2026-08-29, commit d71e188)

Critical audit of health & fitness pages found: no workout logging at all, hardcoded active-minutes chart, fictional "12-day streak", fake "guided plan" rows, dead aiCoach link in the hub rows, no timer/stopwatch. All addressed; 47 → 49 screens.

## Built & verified (exact math, real UI events, clean fixtures)
- **logWorkout sheet:** 8 type buttons (emoji grid), 7 day chips, minutes input/±5/quick chips, Easy/Moderate/Hard, live MET-based estimate. HIIT 45 min Hard → est "~630 kcal" (350/30×45×1.2 exact) → saved {day:5,ty:HIIT,mins:45,kcal:630}. Praise toast rotates. Validation blocks 0 minutes.
- **Hub:** chart = per-day workout minutes (tap a bar → log that day); header chip = computed active days (union of workout+food days); this-week list with per-entry × delete (verified removes + totals recompute); totals line (299 min · 2025 kcal with test seed).
- **Cross-page burn sync:** diary "Exercise −N" now = that day's logged workouts (Sat showed −630 and "2530 left" = 1900+630 exact); dashboard Burned same source; demo Friday seeds (Walk 48 + Strength 38) sum to **exactly 420** so fresh installs are pixel-identical. "Exercise −N" is tappable → fitness.
- **Stopwatch:** live on-screen ticking verified (0:01→0:03 over 2 s), Lap list, pause freezes elapsed exactly (compared ms before/after 1.2 s), Reset, and "Log N min as a workout" (≥60 s) prefills the sheet (3-min session → "3" prefilled).
- **Timer:** presets 0:30/1:00/3:00/5:00 + ±15 s; 3-second countdown auto-finished (tmRun false, 0:00 shown, vibration + toast fire on devices).
- **Persistence/sync:** wlog added to SYNC_KEYS + localStorage whitelist; 7 entries incl. a Sun swim survive hard reload; cloud sync carries it like all other data.
- Crawl of fitness/logWorkout/workoutTimer: 64 controls, 0 errors. (Crawler note: it deletes wlog rows while crawling — restore seed before persistence assertions.)

## Removed as fake
"TODAY'S WORKOUT · Low-impact strength" card with toast-only Start button; hardcoded weekly plan rows ("Guided workout player opens in beta"); "12-day streak"; hub row linking to deleted aiCoach screen (→ live AI assistant instead).

---

# Addendum 7 — live sensor capture round (2026-08-29, commit 084c958)

Critical review conclusion: web apps CAN capture real health data live (motion, GPS, mic, camera, speech, audio, vibration, wake lock) but CANNOT do background all-day tracking (that remains the iOS/HealthKit build). Everything below is real sensor work, feature-detected, failing soft to manual entry.

## Live Workout mode (new screen, 50 total)
Verified E2E (voice stubbed for observability, motion fed through the real handler):
- Setup: 8 activity types, interval presets, Voice coach / Clap control / GPS toggles, beat chips (110–155 bpm).
- Start: countdown beeps → spoken "Let's go — enjoy your run!" (captured), wake lock requested, motion listener attached (iOS permission flow included).
- Auto movement counting: 12 synthetic accelerometer bounces → 7 peaks detected (correct min-gap/threshold behaviour); live 👟 counter on screen.
- Pause/resume (same path the double-clap detector calls), finish → 🎉 celebration with time/moves/kcal/distance grid → Save → wlog entry {ty:Run, mins:1, kcal:10, steps:7}; hub row shows "👟 7".
- HIIT machine (accelerated 2s/2s×2): exact spoken lifecycle "Round 1 — Go!" → "Rest." → "Round 2. Go!" → "Rest." → "All rounds done!" → auto-finish. Rest-end countdown beeps.
- Clap control: double-clap (two mic spikes 160–700 ms apart, 1.5 s cooldown) toggles pause; metronome = Web Audio oscillator, accent every 4th beat; GPS = watchPosition + haversine with accuracy/jump guards.

## Camera pulse check (heart-rate screen)
- Unit: hrFromSamples(72 bpm sine, 15 s) → exactly 72; flat signal → null (honest failure).
- Full pipeline with synthetic 66 bpm "fingertip" video (canvas captureStream through real getUserMedia path): live wave rendered, countdown shown, result 64 bpm (within tolerance) → Save updates hr.
- Defect found by test & fixed: camera result's "Save reading" collided with the BP card's identical label (last-match click hit BP). Camera button now "Save N bpm"; re-verified hr:59 saved.

## Honest limits (stated in-app)
Movement counting runs only while the app is open; desktop browsers have no accelerometer (counter stays 0, session still works); camera pulse is labelled a fun estimate, not medical advice; background/all-day capture ships with the iOS build.

Crawl of liveWorkout/heartRate/fitness: 69 controls, 0 errors.

---

# Addendum 8 — live-workout reliability fixes from phone testing (2026-08-29, commit c9a81e1)

User-reported failures on device: workout data not saving; claps not pausing; expectation of voice "pause"; pulse reading poor. Root causes + fixes, all verified through real pipelines:

1. **Data loss = session was memory-only.** iOS reloads the page on app-switch/lock → session gone before Save. Fix: `recisource_live` localStorage snapshot written every second + on every transition; boot restores it. Verified: started run → hard reload → session still running with elapsed **continuing from original start** (15 s across the reload), dashboard banner "Workout in progress" returns to the screen, "Re-enable movement counting" pill re-arms the sensor (counts again after re-arm). Save now flushes localStorage synchronously (entry present immediately, live key cleared) + cloudPush at 350 ms. Discard = two-tap confirm (verified arm + discard).
2. **Clap detector failed on phones** (fixed threshold vs AGC-processed mic + strict double-clap). Rebuilt: `{echoCancellation:false,noiseSuppression:false,autoGainControl:false}`, adaptive rolling baseline (spike > max(18, base×3)), single-clap toggle, 1.5 s cooldown, live mic-level bar + "👏 heard!" flash. Verified via oscillator bursts through a MediaStreamDestination into the real analyser: burst→paused+flash; burst within cooldown ignored; later burst→resumed.
3. **Voice commands** ("pause"/"go"/"finish") via SpeechRecognition where supported; iPhone Safari has none (stated in UI; claps are the iPhone path). Self-trigger guard: results within 2 s of coach speech ignored. Verified with stubbed SR: pause/go/finish all acted.
4. **Pulse v2:** autocorrelation (lag search 40–200 bpm, r>0.3) + peak agreement, red/green channel selection by variance, torch applyConstraints attempt, live quality dot ("weak → press lighter / more light"), provisional bpm from ~7 s, auto-extend 15→25 s. Units: autocorr(72 sine)=71, combined estimator=72 exact, flat→null. Full synthetic 66 bpm pipeline: provisional 64 live, **final 67** (previous detector: 64).

Known honest limits: iPhone kills JS when the screen locks — elapsed time still ends correct (epoch-based) but movement counting only runs while the screen is on; true background tracking = iOS build.

---

# Addendum 9 — fail-proof controls + generated music (2026-08-29, commit 7221a8d)

User reported clap/voice still not working on-device. Response: (1) likely iOS root cause fixed — clap v3 creates its AudioContext AFTER getUserMedia (pre-existing contexts process mic silence on iOS) and resumes it; (2) added two permission-free controls that cannot fail: **tap the timer ring** (whole ring is the button, labelled) and **shake the phone** (3 motion spikes >7 m/s² within 0.8 s on the already-armed step sensor, 2 s cooldown, "✓ got it!" ring feedback). Voice stays for Android/desktop.

Music/motivation: GROOVES synth engine — look-ahead scheduler, kick (150→45 Hz sweep) + high-passed noise hats (off-beat; doubled in HIIT work) + low-passed saw bass line at Chill 110 / Drive 128 / Power 145; per-step tick sound (toggle, on by default — audible proof the sensor counts); finish fanfare (kicks + 5-note arpeggio + cymbal) + floating emoji burst; streak toast at 6+ active days.

Verified: ring-tap pause/resume; shake fires exactly on 3rd spike with cooldown (clean-instrumented probe: _shk [0,157]→fire at 312 ms, run true) — earlier "failures" were the test's synthetic physics (magnitude of a −z swing barely deviates), not the app; groove scheduler active with AudioContext state 'running'; step ticks fire on counted moves; fanfare/burst render; save/discard clean; prior session-persistence intact.

---

# Addendum 10 — auto-update system (2026-08-29, commit ec5f4ae, v20260829.1714)

Diagnosis of "mic bar doesn't move, no step sounds, where is Drive?": the phone was running a **cached previous build** — the Drive music chips only exist in 7221a8d, so their absence proves staleness; frozen mic bar and missing step ticks follow from the same. Systemic fix:

- `__BUILD_TS__` placeholder stamped by build.ps1 (e.g. 20260829.1714); `version.json` deployed beside the app. Boot fetches it with cache:'no-store'. Newer version + no live workout → toast + auto `location.replace('?v=<ver>')`; live workout active → "A new version is ready" banner on the dashboard instead (session never interrupted; sessions persist anyway). Settings → About shows the running stamp (fixed dev-vs-stamp check: placeholder detection, not length — stamped strings are 13 chars).
- Mic meter now writes the bar width directly from the analyser loop (12×/s, id micbar21) — the old 1 Hz render made a working meter look frozen. Step ticks louder (gain 0.05→0.14). iOS audio unlock (1-sample silent buffer inside the start gesture). On-screen hint that the iPhone silent switch mutes web audio (likely contributor to "can't hear" reports).

Verified: matching version → no prompt; stale version → REAL redirect observed (test stub couldn't hold location.replace — page navigated to ?v=99999999.9999, proving the path); live-session → banner rendered on healthToday; fresh load after redirect → no false prompt loop.

---

# Addendum 11 — real "today" + HR history + totals sync (2026-08-29, commit e9d9e93, v20260829.1731)

User confirmed music + clap working; reported Saturday workout logged to Friday, weekly totals confusion, no HR history.

## Real "today" (the root fix)
`todayIdx()` = real weekday (Mon=0). Replaced every hardcoded Friday default: diary/scan/manual/workout day defaults, dashboard eaten/burned filters, meal-plan selected day, "(today)" markers, and the dashboard header (real `toLocaleDateString`). Day chips show real calendar dates via `weekDates()`. Demo fixtures stay pinned to their fixed weekdays as history — dashboard demo rows/sums gated to real-Fridays only. Verified on machine-Saturday: header showed real date; live workout saved day:5 (Sat) with "(today)"; Saturday diary showed its own Exercise −N; Friday chip still exactly 1140 food / −420 exercise.

## Data flow / totals
Live-workout movements now add to stepsToday (verified stepsToday += moves on save). New synced counters totSteps/totMins/totKcalBurn: incremented on both save paths, decremented (clamped) on delete. Fitness hub shows "All time: N min · K kcal · 👟 M moves"; steps screen gains totals row (week sum, daily avg, all-time workout moves). Honest note: per-day history beyond the current week (true monthly/yearly) needs dated log entries — flagged as the next data-model step; all-time counters cover lifetime totals safely.

## Heart-rate history (records synced + safe)
`hrLog` [{ts,bpm,src}] in SYNC_KEYS. Sources: camera save + "Log current N bpm" button. Heart screen history card: D/W/M range chips, polyline chart with red dots >100 bpm, recent list with real timestamps, ELEVATED badge, per-row delete. Verified: log ×2, elevated 115 shown red with badge, chart rendered, Day filter, scoped delete (first delete attempt in test hit the BP card's identical × — scoped clicking confirmed HR delete works). Pulse reader: first 3 s of samples discarded (finger settle-in).

## Fun layer
8th water cup → chime + "hydration goal smashed" (found & fixed a real guard bug: this React applies setState synchronously here, so the guard read the *new* value — now captures prior value first; verified toast fires). Food logging beeps + praise; cook Finish → fanfare; Today header 🔥 active-days chip → fitness. Final 7-screen crawl: zero errors.

---

# Addendum 12 — UI redesign via ui-ux-pro-max skill (2026-08-29, commit c943d9e, v20260829.1748)

Skill installed from nextlevelbuilder/ui-ux-pro-max-skill; its Python search tool couldn't run (no Python on this machine) so its CSV databases were queried directly — disclosed per the skill's own no-fabrication rule. Verified matches used:
- products/colors #143 "Calorie & Nutrition Counter" (exact product class, HIGH confidence): flat design, healthy green + macro colors, progress-circle emphasis, fast 150ms transitions, no heavy shadows; anti-patterns: muted colors, 3D, low energy.
- #35 "Fitness/Gym App": dark OLED profile for dark surfaces.
- Typography pairing #16 (Lexend — accessibility-focused); single-family Lexend chosen for app cohesion (disclosed deviation from the two-family pairing).

Implementation: L()/D() token rewrite (light mint #ECFDF5 / white cards / emerald ink #065F46 / accent #34D399 / slate text; dark #111827 slate + emerald), dc mount-prop accent default fixed (#B6F03A → #34D399 — it silently overrode theme defaults), lime literal sweep (16 rgba + 7 hex), macro recolor to protein-BLUE/carbs-ORANGE/fat-YELLOW (diary bars + nutrition conic ring + rows), water → blue, hero gradient → mint, 150ms transitions on btn()/chip(), Lexend via Google Fonts link in build skeleton + root font stack, loader rebranded green/mint.

QA (skill priorities 1/2/4): full crawl 50 screens / 855 controls / 0 errors; WCAG contrast on core pairs: muted-on-mint 7.2:1, text-on-card 17.9:1, accentText-on-accent 7.8:1, inkText-on-ink 7.7:1 (all ≥4.5:1). Visual verification: light dashboard, macro-colored diary with real dates, dark dashboard — all match the intended profile.

---

# Addendum 13 — warm & fresh theme + firecrackers + logo candidates (2026-08-29, commit 62b4996, v20260829.1811)

- Gemini image generation: key valid but project has **limit:0** on all image models (free tier without billing) — AI logo gen blocked until billing enabled at aistudio.google.com. Pivot: 4 hand-crafted SVG logo candidates in branding/logo-candidates.html (lettermark+leaf, gradient app tile w/ progress ring, kcal-ring mark, leaf&pulse) delivered to owner for selection.
- Theme (user-directed "warm and fresh"): light {bg #FFF7ED cream, card #fff, text #1C1917, muted #57534E, ink #C2410C burnt orange, accent #FB923C/on #431407}; dark warm charcoal {#1C1917/#292524}; dc mount prop → #FB923C; loader/hero/body warmed. Fresh greens retained on success surfaces (rgba(52,211,153) banners). Contrast verified: 5.2/6.9/7.2/17.5 — all ≥4.5:1.
- boom() firecracker engine: 26 glow particles/burst (Web Animations API, radial + gravity, colored shadows), crack beeps + vibration, hosts z-99999 auto-removed 2.8 s. Hooked into fanfare() (workout+cook completions) and the 8-cup hydration goal. Verified: 52 particles across 2 bursts, teardown clean, water-trigger fires.
- Motion: global button:active scale(.95), fadeup screen-enter animation on wrap() (keyed per screen), prefers-reduced-motion kill-switch.
- QA: 50-screen/855-control crawl, zero errors.

---

# Addendum 14 — rustic theme + per-section backgrounds (2026-08-29, commit 3b05e43, v20260829.1825)

User-directed "rustic, fresh, energetic, modern" with distinct background per Food/Health/Fitness. Implemented:
- Base: linen #F7F1E8 / espresso #2B2119 / terracotta ink #A83E1C / tangerine accent #E8722E (on umber #3B1505); warm-coffee dark mode; loader/hero/shell warmed; dc accent prop → #E8722E.
- Section engine: `secBg(id)` + SEC_FOOD/SEC_HEALTH/SEC_FIT lists; renderScreen overrides `_t.bg` for light non-DARKS screens. Painted verification (computed DOM backgrounds): Food sage rgb(242,244,228)=#F2F4E4, Health clay rgb(249,236,225)=#F9ECE1, Fitness gold rgb(251,240,217)=#FBF0D9, default linen #F7F1E8. Dark screens/dark mode untouched.
- Contrast: ink-white 6.2, accent 5.3, muted vs linen/sage/clay/gold 5.5–5.7, text-card 15.7 — all AA.
- Crawl 50 screens / 855 controls / 0 errors.
- Test gotcha: `app._t` is overwritten by a follow-up render after jump() — assert on PAINTED DOM backgrounds, not _t.

Logo candidates (addendum 13) remain awaiting owner pick — will restyle chosen mark to the rustic palette on selection.

---

## Addendum 15 — Data-accuracy audit round (2026-08-29, build 20260829.1849, commit 02693fa)

User report: recipe pages not showing ingredients/steps and unscrollable on phone; steps counter must feed weekly/monthly totals; nothing hardcoded/demo; thorough check of every interactive page.

### Fixes shipped
1. **Recipe scroll (user-blocking, REPRODUCED)** — at 375×812 the `.scr` scroller had clientHeight=scrollHeight=2038 (flex chain missing `minHeight:0`), so content below the fold was unreachable. Added `minHeight:0` to 5 vertical `.scr` scrollers + recipeDetail's outer flex column. Hardened `tplKey` (`(r.title||'')`) and recIng/recSteps with `TPLS.sweet` fallbacks so no recipe can render empty ingredient/step lists.
2. **Dated history model** — `dkey/dkToday/dkOfIdx(i)` (ISO date keys, Monday-based week), `rollover()` (archives stepsToday→stepsHist[stepsDate] and resets water on day change; runs on boot + after cloud sync), `histStats()` → {weekSum, monthSum, allSum} with this-week hist keys excluded to prevent double-count. SYNC_KEYS += stepsHist, stepsDate, waterDate.
3. **dt date-stamps on every log write** — manualFood, scan Log, saveLive, logWorkout Save. All diary/healthToday/fitness filters are week-precise: `x.dt ? x.dt===dkOfIdx(day) : x.day===day` (legacy entries keep working).
4. **Steps screen de-demoed** — totals row now histStats() (This week / This month / All time tracked). M chart = last-4-weeks buckets from stepsHist + live week. 6M/Y charts computed monthly averages from real history with honest empty-state caption. STEPD demo table deleted. "Your records" (best day, goal streak, all-time, distance) all computed; fake "34% vs last year"/"2.1M"/"Melbourne→Cairns" removed; motivation line computed from today's goal gap.
5. **Settings** — Email row shows sessEmail or "Not signed in" (was hardcoded sofia@example.com). New "Start fresh — clear demo data" two-tap action (5s arm window) zeroing demo fixtures (dhide latte/rice/avoc, wlog, wextra, bpLog, stepsLog, stepsToday, sleepLog, stepsHist) while preserving the user's own diary.

### Test battery (fiber-hooked E2E on localhost:8321, mobile 375×812) — 16/16 groups PASS
- T1 dkOfIdx maps Mon 2026-08-24 … Sun 2026-08-30; today idx 5 = 2026-08-29 ✓
- T2 rollover: backdated stepsDate 08-28/5432 → archived to stepsHist, stepsToday 0, water reset ✓
- T3 histStats independent math: week 6,000 / month 26,000 / all 35,000 (41-day-old entry excluded from month; this-week hist key 99999 not double-counted) ✓
- T4–T8 steps screen renders those exact totals; M/6M/Y captions honest; no 34% claim; records computed ✓
- T9 rapid-tap: 5 real clicks on hero "+" = exactly +2,500; week total tracks live ✓
- T10 entry with last-week dt on same weekday hidden from calorieDiary + healthToday; this-week entry shown; kcal sum honest ✓
- T11 recipeDetail at 375×812: clientHeight 764 vs scrollHeight 2380, scrollTop reaches 800, ingredients ("cooked basmati rice") + method steps rendered ✓
- T12 Start fresh: first tap arms only, second tap clears fixtures, user's dlog preserved ✓
- T13 stepsHist/stepsDate/waterDate + dt persisted in recisource_v1 ✓
- T14 56-screen crawl: all render, zero scroll traps; stricter reachability check (max content bottom vs available scrollers) clean on 24 content-heavy screens ✓
- T15 logWorkout: minutes validation works; save stamps dt, rolls up totMins/totKcalBurn; stale-dt clone excluded from fitness ✓
- T16 manualFood through real input handlers: entry saved with day 5 + dt 2026-08-29 ✓

Deployed: pages-repo commit 02693fa pushed to VinhNguyen065/recisource main; version 20260829.1849.

---

## Addendum 16 — AI chef / grocery / recipe-exit UX round (2026-08-29, build 20260829.1910, commit cbc55d6)

User reports: AI chef stuck on "Golden Turmeric Fried Rice" and can't be spoken to directly; grocery list not interactive, nothing flows from recipes/plan; recipe pages have no exit — only "Start Cooking".

### Root causes found
1. **Recipe exit**: back button was absolutely positioned INSIDE the scrolling hero — scroll down and it left the screen; sticky footer offered only bag + Start Cooking.
2. **Stuck turmeric**: aiChat's context pill rendered `curRec().title`, and curRec() falls back to RECIPES[0] (turmeric fried rice) — pill showed it no matter where the chat was opened from. A second, DEAD import-review screen was fully hardcoded to turmeric (photo food-r1, title, ING slice, Save→recId 1) with no reachable trigger (startImport had zero callers) — deleted.
3. **Chat unusable**: no Enter-to-send, mic icon inert, suggestions were recipe-only.
4. **Grocery**: aisles were a hardcoded demo array of turmeric ingredients; demo staples undeletable; mealPlan "Add all" pushed useless "<title> ingredients" strings.

### Shipped
- recipeDetail: fixed top bar (back / Details / home / menu) overlaid on the scroller at zIndex 5 — visible at any scroll depth; sticky bottom = back + bag + Start Cooking.
- openChat(ctxId,seed?) sets chatCtx per entry point: recipe chips & cookStep sparkle pass the recipe; health/fitness/library promo pass null. Pill only renders with real context and has × to clear. sendChat prepends recipe context (title/kcal/servings) to the wire when set. Enter submits (enterKeyHint 'send'); micChat() uses SpeechRecognition when available with honest fallbacks; suggestion chips switch general vs recipe sets. chatLog now persisted.
- cookStep: fake "Listening… say next" mic replaced with sparkle → chef with this recipe; hint text honest.
- Grocery v2: gItems objects {n,q,aisle,src} (guessAisle keyword classifier; legacy gExtra migrates via gList()); every row deletable, checkbox, qty bold, source line "For <recipe> · N kcal/serve" with jump-to-recipe chevron; aisle groups with counts in aisleOrd order; progress card "n of m in the basket" + bar; 100% → boom() firecrackers + toast; "Remove bought"; share button emits real list text via navigator.share/clipboard; empty state with guidance; quick actions "Add today's plan" / "From a recipe". addToGrocery pushes scaled-qty objects with recipe src (case-insensitive dedupe). mealPlan slots refactored to shared planSlots(); "Add this day to grocery list" exports real ingredients. gItems persisted (SYNC_KEYS).

### Tests (fiber E2E, mobile 375×812) — all PASS
- U1 back visible after full scroll (top=58px); bottom bar 3 buttons. U2 general mode: "Your AI Chef", no turmeric pill, general chips. U3 recipe mode: pill with actual recipe, chips switch, × clears ctx. U4 Enter-to-send → LIVE edge-fn reply round-trip ("KITCHEN OK").
- G1 empty state + quick actions. G2 legacy gExtra migrates with aisle guesses (Dairy & Eggs / Meat & Fish). G3 Enter adds + progress "0 of 3". G4 case-insensitive dupe block. G5 recipe→bag→list: 5 items, src=Cinnamon Oat Latte, rows show "For … · kcal/serve", "from 1 recipe" chip. G6 check-all → "All done" + celebration + toast. G7 Remove bought empties list. G8 mealPlan day export: 17 items/3 recipes, dedupe-safe re-add, navs to grocery. G9 cookStep→chef carries recipe ctx. G10 gItems + chatLog persist in recisource_v1.
- Full 56-screen crawl: all render, zero unreachable-bottom scroll traps.

Deployed: commit cbc55d6 → VinhNguyen065/recisource main, version 20260829.1910.

---

## Addendum 17 — Meal plan rebuilt on real dates (2026-08-29, build 20260829.1957, commit 8d3cc0a)

User report: meal plan stuck in July, can't move between dates/months, feels like a demo; wants filters + integration with grocery etc.; review grocery buttons for simplicity/fun.

### Root causes
- Week labels were a hardcoded 3-element July array (`['Jul 7 – 13','Jul 14 – 20','Jul 21 – 27']`), planWeek clamped to ±1, off-week day numbers faked (`14+i+wk*7`), Month view was only a toast.

### Shipped
- `mondayOf(wk)` / `weekLabel(wk)`: all labels and day-chip dates computed from the real calendar; browse −8…+8 weeks; the label doubles as a "tap for today" shortcut; today outlined in the day strip.
- **Month view**: real 5-week grid (last week → +3), per-day accent dots = planned meal count, today outlined, tap any cell → that week/day in Week view.
- **Planned vs Suggested**: badges on every slot; suggestion cards get ✓ accept, ✨ swap, 🔍 pick-from-library; planned cards get × unlock. "Keep this day" locks all four with boom(2). Legacy Wed-dinner demo fixture removed.
- **Filters**: All / Vegetarian / High-protein (≥25 g) / Quick (≤20 min) / Light (≤400 kcal) via `planFilterFn`; planSlots draws suggestions from the filtered pool, so the grocery-export path (addPlanDayToList → planSlots) automatically honors the active filter. planFilter persisted.
- **Data integration**: day summary card totals the 4 slots' kcal vs kcalGoal (bar turns heart-red >115%); "Add this day to grocery list" ships real scaled ingredients (from round 6).
- **Grocery copy tiers**: 0% "Ready to shop — N items to grab", <50% "Off to a good start", ≥50% "Almost there!", 100% "All done — great shop!" (+ existing firecrackers). Reviewed buttons: kept back/settings/share + add-input + two quick actions; removed nothing further (the demo list-chips row was already gone in round 6).

### Tests (fiber E2E, 375×812) — all PASS
P1 real label "Aug 24 – 30", no July, real day dates · P2 +4 weeks → "Sep 21 – 27", tap-label returns to today (deepest-element caveat in the probe, handler fine) · P4 SUGGESTED badges, summary "of your 1,900 goal", ✓ → PLANNED + planX written · P5 Keep-this-day → 4/4 locked · P6 Quick/Light/Vegetarian filters verified against recipe fields · P7 Month grid renders Sep dates, 4 planned dots, tap-cell jumps to Week view (wk=1) · P8 day export → 17 grocery items + "Ready to shop" tier · P9 "Almost there!" at ≥50% checked · P10 planFilter/planX persisted · P11 full 56-screen crawl clean.

Deployed: commit 8d3cc0a, version 20260829.1957.

---

## Addendum 18 — Import review & save flow (2026-08-29, build 20260829.2012, commit 2f45df6)

User report on link import: no photo populates; no save/confirm button; back returns to the link form; no confirmation the recipe was added; wants the same for text/manual/camera options.

### Root causes
- runImport saved instantly with only a toast — no review, no explicit Save, no confirmation UI; history kept the link form underneath so Back returned there.
- Backend url mode never returned an image; client showed the recipe with a blank/placeholder slot.
- Photo-scanned recipes went into volatile id-999 (not persisted across reloads).

### Shipped
- **Review & save screen** (`importReview`, food-section themed) used by ALL import paths — link, pasted text, and camera recipe scan: photo preview, "nothing is saved until you hit Save" banner, editable title, meta chips (kcal/serve, N ingredients, N steps, source), full ingredient list, first-3-steps preview, footer **Discard | Save recipe**.
- **Photos**: backend `image_url` honored when present; YouTube links get a client-derived thumbnail (`ytThumb` → img.youtube.com); microlink.io best-effort fallback for other sites; camera scans use the captured shot; manual **Add/Change photo** button (existing pickImage → 700px JPEG) covers the rest with an honest "No photo on that page — tap to add one" placeholder.
- **Save**: importRecipe now rewrites history to `['library','recipeDetail']` (Back = Home, never the link form), sets a dismissible green **"Saved to your library"** banner on the recipe, fires boom(2) + named toast. Scan-photo "Count kcal" banner condition widened to follow the new persistent recipes (`r.img===scanImg`).
- **Discard**: returns to the import menu with "Nothing was saved".
- **Camera recipe scans** now save via importRecipe/myRecs → photo + recipe persist across reloads (fixes the old unpersisted-999 gap).
- Backend **v20 written** (og:image/JSON-LD/oEmbed thumbnail extraction, additive) at app-store-package/backend/scan/index.ts — **deploy blocked**: Supabase MCP `deploy_edge_function` rejects `files` ("expected array, received string"; opaque deferred schema — harness can't encode arrays), no CLI/npx/access token on machine, Chrome-dashboard route needs the user to pick between two connected browsers. Pending user action; client works fine against live v19 meanwhile.

### Tests — all PASS (stubbed + live)
- I1 review screen: nothing saved pre-Save, photo rendered from image_url, editable title, meta + ingredients, Save/Discard present.
- I2 Discard → import menu, zero recipes added. I3 Save with edited title → myRecs + img, recipeDetail + banner, history exactly ["library","recipeDetail"], Back → Home, recipe visible in library.
- I4 ytThumb: watch/shorts/youtu.be ids → img.youtube.com; non-YouTube → null. I5 camera-scan → review carries captured photo → saved recipe keeps it + Count-kcal banner. I6 myRecs (with img) persisted. I7 empty-state honest. I8 after real reload: 2 recipes restored into RECIPES, detail shows live ingredients/steps, WIMG rebound. I9 57-screen crawl clean.
- **LIVE L2** (real backend v19, real site): recipetineats.com/carbonara → review "Spaghetti Carbonara (Authentic, No Cream)" → Save → banner → Back → Home. Microlink missed that site (bot-protected) → placeholder + Add-photo path, as designed. scan_debug confirmed the user's own earlier URL imports succeeded server-side (their complaint was the missing flow, not the backend).

Deployed: commit 2f45df6, version 20260829.2012.

---

## Addendum 19 — Account & plans flow (2026-08-29, build 20260829.2025, commit 67dc15f)

User report: clicked Create Account and couldn't get back into the app; asked for full real-email signup verification and a plans/payment-options step.

### Root causes
- auth screen had NO back button and NO skip — the only exit was a successful signup (the trap the user hit).
- paywall screen was an orphan (zero nav entries anywhere), its Continue was a bare "Welcome to 21 Pro!" toast, no Free option, no plan state, and prices implied real billing that doesn't exist.
- Settings "Sign out" was a demo toast.

### Shipped
- **auth**: back button (falls back to welcome when history is empty) + "Skip for now" link → jump('library') with an offline-mode toast. No dead end remains.
- **Signup journey**: Create Account → (edge fn signup + password-grant login + cloud sync) → **plans step** (postAuth flag: welcome banner "Account created — pick a plan to finish up") → chosen plan → Today screen. Login skips plans and goes straight in.
- **Plans screen**: three cards — Annual Pro ($39.99/yr *at launch*, Save 44%), Monthly Pro ($5.99/mo *at launch*), **Free** ($0 · scan, log, sync & 5 imports/month) — plus an explicit beta banner: "every plan is free right now — no card, no charge; your pick just tells us what you'd choose at launch." Continue button text tracks the selection; on tap sets `planTier` (in SYNC_KEYS → cloud-synced), boom(2), honest toast, jump to Today. Close = back (or into the app when arriving from signup). No fake payment is ever taken or implied.
- **Settings**: new Plan row (shows "Annual Pro (beta)"/"Monthly Pro (beta)"/"Free", opens the plans screen); Sign out now calls logOut() for real (guarded when not signed in).

### Live E2E (real backend, real email www.vinhnguyen+21beta0829a@gmail.com) — all PASS
- A1 back + Skip present; Skip → library; back → welcome.
- S1 signup through the real inputs → session for that email → lands on plans with postAuth banner, 3 plans, beta note.
- S2 Annual selected → "Choose Annual · free in beta" → Today, planTier='annual'.
- S3 Settings shows the real email + "Annual Pro (beta)"; Plan row opens plans; close returns to Settings.
- S4 cloudPush ok → Sign out clears session+LS → log back in via UI → session restored, **cloud-restored stepsToday=3333 and planTier=annual**, login lands on Today (no plans detour).
- S5 wrong password rejected, no session. S6 duplicate-email signup → friendly "already has an account" toast, stays on auth (with escape hatches).
- SQL verification: auth.users row confirmed=true, user_state row present (1,339 bytes).
- S7 58-screen crawl clean.

Deployed: commit 67dc15f, version 20260829.2025. Note: the beta test account www.vinhnguyen+21beta0829a@gmail.com (password TestBeta21!x) exists in the project — delete before public launch.

---

## Addendum 20 — Cards, quick-add menu, family sharing (2026-08-29, build 20260829.2042, commit e10969a)

Requests: more modern high-contrast themes; recipe-card + button should offer plan/grocery/calendar (not just grocery); bigger photos (~2/3 of card) with compact kcal+time, less description; in-app share, add family members, share recipes.

### Found
- Card + button was a FAKE: `showToast('Added to grocery list')` with no mutation.
- household screen was orphaned (no nav path) and fully demo (Sofia's Home, fake members, fake stats, invite=toast). shareSheet rows all ended in toast('Shared').

### Shipped
- **Cards restyled**: grid photo 116→150px (≈2/3 of card) with kcal+time pill (flame/clock) + rating (moved top-left) + heart on the photo; body = 2-line clamped title + action button only (descriptions dropped). List cards 122×96 photo, kcal+time row, no sub.
- **Quick-add sheet** (state qaRec, rendered at screen root above tabbar): recipe header w/ thumb; actions — *Add ingredients to grocery list* (gAdd, primary), *Plan it this week* (day chips + Brekky/Lunch/Dinner/Snack chips → planAccept + boom(1), plus **+ Calendar** exporting a real .ics via downloadIcs: next occurrence of picked weekday at slot time 8:00/12:30/18:30/15:00, 45 min, verified VCALENDAR/DTSTART), *Share this recipe* (native share/clipboard), *Save to favourites* toggle. Backdrop/close dismisses.
- **Family & sharing (household)**: reachable from Profile → "Family & sharing"; owner = userName with initial avatar; live stats (RECIPES count / grocery items / planned-this-week from planX '0-' keys); add member by name (Enter or Add, persisted hhMembers → SYNC_KEYS) with × remove; "Send an invite link" = navigator.share/clipboard message with the Pages URL; honest note that cross-account library sync is a future update.
- **shareSheet rows real**: Share with family → household; Copy link → clipboard recipe link; More options → shareRecipe.
- **Theme galleries**: 21-theme-gallery-2.html adds G Electric Violet / H Midnight Citrus / I Flamingo Punch / J Forest & Peach / K Cobalt Pop / L Matcha Cream (near-black or saturated buttons on airy bgs, subtle section tints). Also delivered 21-beta-invite.html (QR card) earlier this session. Choice pending (A–L).

### Tests (fiber E2E, 375×812) — all PASS
C1 grid photo 150px + kcal/time visible · C2c + opens sheet with all 5 actions (28 accent buttons found) · C3 grocery action adds real items & closes · C4 Wed+Lunch picks → planX['0-2-Lunch'], shows PLANNED in meal plan · C5 .ics generated (cook-egg-fried-rice.ics) with valid VCALENDAR/SUMMARY/DTSTART · C6 share fires (clipboard fallback captured), save toggles · C7 profile row, "Vinh's Home", no demo members, add/remove member, invite contains app link · C8 shareSheet family row routes to household, hhMembers persisted · C9 57-screen crawl clean.
Note: perl-with-Unicode on this file caused one mojibake ('·'→'Â·') — repaired; use sed byte-safe patterns or Edit tool for lines with multibyte chars.

Deployed: commit e10969a, version 20260829.2042.

---

## Addendum 21 — List cards, SMS invites, alerts, weight audit, stub sweep (2026-08-29, build 20260829.2103, commit e4224b6)

Requests: list-view photos as big as grid; Family add flow should take a phone number and send a link; audit for dead demo buttons; test the alert button; audit weight ("wait") page milestones/goals for correctness + interactivity.

### Shipped
1. **List cards**: photo 122×96 → 132×132 with rating pill on-photo, 2-line clamped 15.5px title, kcal/time row — consistent with the 150px grid cards.
2. **Family & sharing**: member model upgraded to {n, ph} (legacy strings still render/work); add form = Name + Phone (optional, tel keyboard, sanitized); each member row has **Send link** → `sms:<number>?&body=<invite+app URL>` opening Messages pre-filled, falling back to navigator.share/clipboard when no number.
3. **Alerts (bell)**: was `showToast('No new alerts')`. Now `getAlerts()` computes live: HR>100 (warn), last BP ≥140/90 (warn), eaten>kcalGoal (warn, dt-aware), steps≥goal (good), water≥8 (good), weight goal reached direction-aware (good). Bell shows a red badge dot when any alert exists and opens a new **alerts** screen (health-tinted): warn=red border/good=green, each row navigates to its page, "not medical advice" note, friendly all-clear empty state.
4. **Weight page de-demoed**:
   - Hero: hardcoded "▼ (72.8−last) kg since January" → computed vs first check-in ("▲/▼ X kg since you started (78.4 kg)").
   - Pace: fixed 0.2 kg/week fantasy → rate from last 5 check-ins; only claims a pace when actually trending TOWARD goal ("goal in about N check-ins"), else honest "log regularly to see your pace"; goal-reached handles loss AND gain directions.
   - W/M ranges: synthesized fake dips → real last-7/last-4 check-ins; captions say "Last N check-ins"; hardcoded month x-labels (Sep '24/Mar '26/…) → earlier/latest.
   - Milestones: fully hardcoded (First 2 kg Nov 2024 / Below 75 / 20-week streak) → computed & direction-aware: Started tracking (baseline+count), First 2 kg down/up, Halfway to goal, Goal (all with live to-go amounts, follow wGoal steppers).
5. **Stub sweep** (pretend-success eliminated): cookTimers "Add a timer"→'New timer' toast replaced with +3/5/10/15-min presets that really set & start t1; mealTemplates "Save current week as template" now snapshots this week's planX into persisted myTpls (accent cards with Apply→merges into week 0 & × delete; honest toast when nothing planned); Settings "Delete account" ("check your inbox" lie) → opens a pre-filled deletion email + honest note; "Help & Support" → support email; paywall "Restore" → "Nothing to restore — everything is free during the beta". Remaining "in beta" labels (collections rename/create, store picker, public-profile messaging) are honest capability statements, left as-is.

### Tests (fiber E2E, 375×812) — all PASS
W1 no "since January", baseline 78.4 shown, computed milestones, no fake ones · W2 log 71.4 via steppers → wextra, W-range shows real check-ins ending 71.4 · W3 pace/honest message present, goal steppers drive milestones · B1 bell→alerts, clean empty state, no badge when clear · B2 hr 112 + BP 150/95 + 12k steps → exactly 3 alerts, badge dot renders, warn+good rows, tap→heartRate · H1 name+phone add → {n:'Levi',ph:'0412 345 678'}, Send link builds sms:0412345678?&body=…recisource…, legacy string member renders · H2 list photos 132px · H3 +5 min preset sets t1=300 running · T1 template save (2 meals) + apply after wipe + honest empty save · T3 59-screen crawl (alerts included) clean.

Deployed: commit e4224b6, version 20260829.2103.

---

## Addendum 22 — Flagship weight page (2026-08-29, build 20260829.2115, commit 511380c)

Request: make Weight the best page — daily interactive tracking, loss shown, multiple graphs, log reminders, fun, filters, full dated history (date AND time), future-weight projection.

### Shipped (full rewrite of case 'weight')
- **Dated model**: new `wlogD` [{w, ts:ISO}] persisted+synced; Log writes both wlogD (dated) and legacy wextra (chart continuity). Delete keeps both consistent (splices matching wextra value).
- **Daily habit loop**: 🔔 reminder banner when today isn't logged (only once dated history exists) + matching alert in the bell's getAlerts(); 🔥 N-day streak chip (consecutive dkeys, tolerant of not-yet-today); "✓ Logged today" chip; Log→Update button; log card shows "Last: 71.5 kg · 29 Aug 8:15 am" and same-time-daily tip.
- **Three graphs** (segmented control): **Trend** (prefers real dated logs — "Your real logs" caption — with W/M/3M/6M/1Y/All day-based filters over wlogD, falls back to check-in slices), **Change** (per-check-in Δ bars, green when moving toward goal — direction-aware for loss AND gain), **Future 🔮** (solid history + dashed orange 8-week projection at the user's actual recent pace; honest captions: ETA "hit 70 kg around <date> 🎯" only when genuinely trending toward goal, "path bends away — small tweaks turn the orange line around" when not, "log a few weigh-ins" when no trend data).
- **Celebrations**: boom(4) + "GOAL REACHED" on crossing the goal (direction-aware crossing detection), boom(1) + "New low/high" on personal records, streak-aware log toasts, 🎯 At-goal chip.
- **Full history**: newest-first dated rows (day-of-month block, weekday · h:mm time, weight, ±delta pill colored by goal direction, × delete), 30-row window with "everything kept & exportable" note, friendly pre-history hint.
- **Start fresh** now also wipes wlogD and sets wDemoOff (demo WLOG hidden everywhere incl. getAlerts) → true empty state ("watch this space come alive 📈"), hero falls back to curW.

### Tests (fiber E2E, 375×812) — 26/26 PASS
V1 renders, no premature reminder, 3 graph tabs, history hint · V2 Log → {w:71, ts ISO}, Logged-today chip, Update button, history row with time · V3 second entry + −0.4 delta pill · V4 3 seeded back-days → reminder banner + 3-day streak + bell alert · V5 downward trend → "hit 70 kg around <date>" + dashed polyline; V5b rising-away → honest bend-away message · V6 change bars with +0.4/+0.5 red · V7 W filter → "Your real logs" · V8 row delete syncs wlogD+wextra · V9 wlogD persisted · V10 goal-cross → GOAL REACHED toast + At-goal chip · V11 Start fresh → wDemoOff, empty-state chart, no 78.4 baseline · V12 59-screen crawl clean.

Deployed: commit 511380c, version 20260829.2115.
