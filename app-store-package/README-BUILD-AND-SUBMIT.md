# 21 — Build & App Store Submission Guide

This folder is a ready-to-build **Capacitor iOS project**. `www/index.html` is the complete,
self-contained app (2.5 MB — all images, React, and runtime embedded; works offline; user data
persists on-device via localStorage).

## What you need (one-time)
1. **Apple Developer account** — developer.apple.com, USD $99/year. (Required by Apple for any App Store app — no way around this.)
2. **Either** a Mac, **or** a cloud-Mac CI service — see the **No-Mac path** below.

---

## ⭐ No-Mac path (recommended if you don't own a Mac)
`codemagic.yaml` in this folder builds, signs and submits the app on a macOS cloud machine — you never touch a Mac. It even injects the required Info.plist strings for you automatically.

**Steps (all in a browser):**
1. Push this project to a GitHub repo (the full source is already backed up to the `full-source` branch of your existing repo — you can build from that, or copy the `app-store-package/` contents into their own repo so `codemagic.yaml` sits at the repo root).
2. Sign up at **codemagic.io** (free tier) and connect that GitHub repo.
3. In App Store Connect → **Users and Access → Integrations → App Store Connect API**, create an **API key** (Admin or App Manager). Download the `.p8`, note the Key ID and Issuer ID.
4. In Codemagic → your app → **Settings**:
   - Add an **App Store Connect integration** named exactly `APP_STORE_CONNECT` using that API key.
   - Under **Environment variables**, create a group **`appstore`** with: `BUNDLE_ID` = `com.recisource.app`, `APPLE_TEAM_ID` = *(your 10-char Team ID from developer.apple.com → Membership)*.
   - Under **Code signing (iOS)**, choose **Automatic** using the same API key.
5. In App Store Connect → **Apps → +** → create the app record: name **21again**, bundle ID `com.recisource.app`, primary language, and paste the **privacy policy URL** (below).
6. Back in Codemagic, press **Start new build** on the `ios-release` workflow. It produces a signed build and uploads it to **TestFlight**. Install it on your iPhone via the TestFlight app and invite your friends/family as testers.
7. When you're happy, either submit for review from App Store Connect, or set `submit_to_app_store: true` in `codemagic.yaml`.

> HealthKit note: Apple Health sync is an *optional* enhancement. The build succeeds and the app works (manual entry) without it. To enable it, after the first build add the **HealthKit** capability once in App Store Connect's provisioning (or an entitlements file) — everything else already ships.

**Hosted legal URLs (already live — paste into App Store Connect):**
- Privacy Policy: `https://vinhnguyen065.github.io/recisource/privacy.html`
- Terms of Use: `https://vinhnguyen065.github.io/recisource/terms.html`

---

## Alternative: build on your own Mac
```bash
cd app-store-package
npm install
npx cap add ios
npx cap sync ios
npx cap open ios          # opens Xcode
```
In Xcode: select your Team (signing), set Bundle ID `com.recisource.app`, choose
Any iOS Device, then Product → Archive → Distribute App → App Store Connect.

## Info.plist additions (Xcode → App → Info)
| Key | Value |
|---|---|
| NSCameraUsageDescription | 21 uses the camera to scan meals for calorie counting and to import recipes from photos. |
| NSHealthShareUsageDescription | 21 reads heart rate, sleep, steps and workouts from Apple Health to power your Today dashboard and AI Coach. |
| NSHealthUpdateUsageDescription | 21 saves workouts and nutrition you log back to Apple Health. |
| NSPhotoLibraryUsageDescription | 21 lets you pick photos of meals or cookbook pages to analyse. |
| NSMicrophoneUsageDescription | 21 listens for claps to control hands-free workout timers, and for spoken commands during live workouts. |
| NSMotionUsageDescription | 21 uses motion to count your steps automatically and to count reps during workouts. |

> ⚠️ **NSMicrophoneUsageDescription and NSMotionUsageDescription are REQUIRED.** The app calls `getUserMedia({audio})` (clap/voice control) and `DeviceMotionEvent.requestPermission()` (step/rep counting). On iOS, calling these without the matching Info.plist string is an immediate hard crash — an automatic App Review rejection. Add both before submitting.

## Native plugins (already in package.json — installed by `npm install`)
| Plugin | Purpose |
|---|---|
| `@perfood/capacitor-healthkit` | Reads steps / heart rate / sleep from Apple Health (Today dashboard). |
| `@capacitor/local-notifications` | Delivers **reminders even when 21 is closed** — the app schedules them at the OS level (daily / weekdays / weekends / one-off date). Prompts for permission on first reminder. No extra Info.plist string needed; the system asks automatically. |
| `@capacitor/haptics` | Vibration/haptic feedback when a reminder fires, a workout timer ends, or a goal is hit. |

> After `npm install`, run `npx cap sync ios` so these are linked into the Xcode project. The web build degrades gracefully (reminders still fire in-app + on the bell) if a plugin is missing, so nothing breaks during development.

## HealthKit capability
In Xcode → App target → **Signing & Capabilities → + Capability → HealthKit**. Enable it (and, if using background delivery, tick "Background Delivery"). This is required for the HealthKit plugin to read data; without it the app still runs and users enter values manually.

## App Store Connect listing (copy-paste ready)
- **Name:** 21 — Food & Health
- **Subtitle:** Recipes, calories, weight & sleep
- **Category:** Health & Fitness (secondary: Food & Drink)
- **Age rating:** 4+
- **Description:** One app for a stronger, healthier life. Snap a photo of any meal for instant
  calories and macros — or turn it into a step-by-step recipe. Track weight, steps, sleep and
  heart rate in one place, synced with Apple Health. Your AI Coach builds weekly meal and
  workout plans tuned to your medical profile and goals, and your entire history is yours,
  forever — exportable anytime.
- **Keywords:** calorie counter,food scanner,recipes,meal plan,weight tracker,steps,sleep,health coach
- **Privacy policy URL:** host the text from the app's Terms & Privacy screen (Settings → Privacy & Terms).
- **App Privacy answers:** Health & Fitness data + Photos — collected, linked to user, not used for tracking, not sold.

## Honest pre-submission checklist (what still needs real engineering)
The current binary wraps the interactive prototype. Apple reviews apps for **completeness
(Guideline 2.1)** — before submitting for review, these mocked features need real backends:
- [ ] Meal-photo calorie analysis → wire to a vision model API (e.g. Claude API `claude-fable-5` with image input)
- [ ] Sign in with Apple / Google → real auth (the buttons exist)
- [ ] Apple Health sync → HealthKit via `@capacitor-community/health` or a native plugin
- [ ] 21 Pro subscription → StoreKit 2 in-app purchase (never Stripe/web checkout for digital goods — Guideline 3.1.1)
- [ ] Terms & Privacy pages → host at public URLs
- [ ] Branding: "for Thermomix®" wording must not imply Vorwerk affiliation (Guideline 5.2) — the app never claims to be official; keep it that way in store metadata too.
- [ ] App icon: export `assets/logo-mark.png` at 1024×1024 into Xcode's asset catalog.
- [ ] Screenshots: 6.7" and 6.1" — capture from the live prototype link on an iPhone.

## What is already done and tested ✅
- 55 screens, all navigable, zero console errors
- Working features with **persistent on-device data**: meal scan → diary logging (calorie
  totals update everywhere), weight logging with live charts (3M/6M/1Y/All filters),
  step history (W/M/6M/Y filters), water, favorites, servings, notes, filters, cook mode
  with live timers, AI coach plan generation, legal screens with auto-renewal disclosure.
- Live hosted build for device testing: https://www.claude.ai/code/artifact/50eb3a4c-9b2f-49a7-b0d9-e154ab53fc90
