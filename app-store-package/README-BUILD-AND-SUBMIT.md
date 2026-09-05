# 21 — Build & App Store Submission Guide

This folder is a ready-to-build **Capacitor iOS project**. `www/index.html` is the complete,
self-contained app (2.5 MB — all images, React, and runtime embedded; works offline; user data
persists on-device via localStorage).

## What you need (one-time)
1. **Apple Developer account** — developer.apple.com, USD $99/year.
2. **A Mac** (any recent one) *or* a cloud Mac build service (Codemagic / Xcode Cloud — both have free tiers).
3. Node.js 18+ installed on that machine.

## Build steps (on the Mac)
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
