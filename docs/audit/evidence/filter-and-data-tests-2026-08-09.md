# Evidence log — filter, data-accuracy and integration tests (2026-08-09)

Environment: built app `app-store-package/www/index.html` served at `http://localhost:8321` (PowerShell HttpListener), Claude Browser pane (Chromium). Tests driven through the real UI event handlers via injected JavaScript; expected values computed independently from the in-app fixture data before comparison.

## T1 — Calorie diary day filter (PASS)
- Fixture: demo meals exist only on Friday: Cinnamon Oat Latte 210 + Golden Turmeric Fried Rice 380 + Chicken/rice/avocado 550. Independent sum = 1140.
- Default day Friday: DOM shows `Food 1140`. ✓
- Click `Mon` chip: `state.diaryDay` → 0, DOM shows `Food 0`, latte row absent. ✓ (correct exclusion)
- Click `Fri` chip: `Food 1140` returns, no stale state. ✓
- Raw result: `{"friFood":1140,"monFood":0,"monDay":0,"monHasLatte":false,"backFriFood":1140}`

## T2 — Delete demo meal + cross-screen sync (PASS)
- Click `×` on latte row → `Food 930` (1140−210 ✓), `state.dhide=["latte"]`.
- healthToday screen `Eaten 930 kcal` — dashboard synchronized with diary. ✓

## T3 — Logged-row kcal steppers incl. rapid-tap (PASS)
- Injected one logged entry `{day:4, n:'Audit Fixture Meal', kcal:300}` (same shape the scan-log path writes).
- Diary total 1230 (930+300 ✓). `+` → 1255 (+25 ✓). `−` → 1230 ✓.
- Rapid-tap 4 × `+` in one frame → 1330 (+100, exactly 4 increments — click-time state reads confirmed). ✓
- Raw: `{"foodWithFixture":1230,"plusCount":1,"afterPlus":1255,"afterMinus":1230,"afterRapid4":1330}`
- healthToday "Today's meals" renders the entry as "Audit Fixture Meal · logged just now". ✓
- kcal-left ring cross-check: 1900 goal − 1330 food + 420 exercise = 990; DOM showed `990 kcal left`. ✓

## T4 — Water logging (PASS, with UX note)
- The 8 cup icons live on calorieDiary; `onClick: setState({water:i+1})` (tap cup N sets level N).
- Clicked cup 7 → `state.water` 5→7, DOM updates. ✓
- healthToday Water tile ("Cups · tap to log") **navigates to the diary** rather than logging directly — logged as DEF-004 (P3 UX wording).

## T5 — Weight screen (PASS)
- Range chips: default `6M`; click `W` → `state.weightRange='W'`; click `M` → `'M'`. ✓
- Goal steppers (2 found): click − → `wGoal` 70 → 69.5. Displayed. ✓

## T6 — Steps screen (PASS)
- `stepGoal` 10000, `stepsToday` 7842 → 78% shown in DOM (matches round(7842/10000)). ✓
- 7 day bars clickable; click Wed bar → `stepsSel=2`, Wednesday's 7,400 value displayed. ✓

## T7 — Sleep score formula (PASS)
- 7h20m = 440 min; expected score = round(100 − |480−440|/6) = 93 (clamped 40–100). DOM shows `Score 93`. ✓

## T8 — Heart rate / blood pressure (PASS)
- Defaults 118/76. Click `Save reading` → `bpLog` length 2→3; history row `118/76` rendered. ✓

## T9 — Meal plan (PASS)
- View toggle `Week` → `state.planView='Week'`. 7 day chips; click Tue → `planDay=1`. ✓
- 4 swap (spark) buttons; click swaps the recipe (DOM changed) **without** navigating away — stopPropagation intact. ✓

## T10 — Search query filter (PASS)
- Ground truth: 27 recipes in fixture. Query "chicken" → expected {Chicken Fried Rice, Chicken Biryani, Butter Chicken, Crispy Chicken Burger}.
- All four shown; non-matching titles absent. Inclusion AND exclusion correct. ✓

## T11 — Dietary-filter sheet + library combination filter (PASS)
- Sheet chips: Breakfast/Lunch/Dinner/Snack, Easy/Medium, 4.5★/4.0★/Any, Reset (10 controls) + kcal range slider.
- Applied Breakfast + Easy → `filters={meal:'Breakfast',diff:'Easy'}`.
- Independent expected set: Cinnamon Oat Latte, Cheese Dosa, Idli & Sambar (3 recipes).
- Library shows exactly those 3; all excluded titles absent; dietaryFilters sheet count badge = "3 recipes". ✓
- Reset chip restores documented defaults `{diet:[],meal:null,maxTime:60,diff:null,minRating:0,allergens:[],maxKcal:800}`. ✓

## T12 — Search results IGNORE the dietary filters (FAIL → DEF-001, P2)
- With Breakfast+Easy active, the search screen (empty query) shows all 27 recipes, not the filtered 3; no active-filter pills.
- Root cause (source): `searchResults() = query-only filter over this.RECIPES` — it never consults `state.filters`, while `filtered()` (used by library and the sheet count) applies all 7 filter dimensions. The search screen even links to the filter sheet ("Filters" button) and its empty state says "Try loosening your filters."

## T13 — Persistence across reload (PASS, with design note)
- Mutated state, waited past the debounced save, hard-reloaded (fresh JS context confirmed).
- Persisted correctly: water 7, dhide ["latte"], dlog (1 entry), wGoal 69.5, bpLog 3 entries, stepGoal, diaryDay.
- Not persisted (reset to defaults): planDay, planView, weightRange, filters — these are absent from the setState persistence whitelist. Recorded as an open design question (OQ-2), not a defect.

## T14 — Scan failure path, client (PASS)
- Drove real pipeline: mealScanAnalyzing → `runScan('cal', <blank 1px PNG>)`.
- Server rejected (502); client popped cleanly back to mealScan; no crash; no unhandled error. ✓

## T15 — Scan backend live checks (PASS)
- Endpoint: `…supabase.co/functions/v1/scan` (anon key from client build).
- Blank 1-px PNG → HTTP 502, structured JSON error (media-type mismatch: function pins image/jpeg): `{"error":"…image/jpeg media type, but the image appears to be a image/png…"}` (0.77 s).
- Real JPEG (butter-chicken asset extracted from the app bundle) → **HTTP 200 in 5.9 s**:
  `{"items":[{"n":"Butter chicken …","portion":"1 serving (~250 g …)","kcal":430,"p":28,"f":28,"c":14}],"confidence":80}` ✓
- Barcode and recipe modes not re-run this session; both verified by curl + on-phone E2E earlier the same day (2026-08-09, edge function v15/v16) — recorded as prior evidence, Medium confidence.

## T16 — Rename verification (PASS)
- `<title>21</title>`; topbar/loader "21"; paywall "21 Pro"; legal "21 provides general wellness…", "21 Pro renews automatically…"; add sheet "Add to 21". Zero occurrences of the old name anywhere in the rendered app (case-insensitive DOM sweep).
- localStorage key `recisource_v1` intentionally preserved (renaming it would orphan all existing users' saved data).

## Console/network observations
- Boot request `GET /.image-slots.state.json` → 404 (dc-runtime editor support file; harmless in production but logs console errors) → DEF-003.
- No other console errors during normal navigation and the test battery.
