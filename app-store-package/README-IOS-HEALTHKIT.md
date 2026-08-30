# 21 — iOS build with Apple Health (HealthKit) sync

The web app already contains the Health bridge (`syncHealth()` in the app code): on the web it
politely explains itself; inside this iOS build it requests HealthKit permission and pulls
**today's steps, latest heart rate, and last night's sleep** into the app. Manual entry always
remains available.

## What you need (this cannot be built on Windows)
- A Mac with **Xcode 15+** (or a cloud Mac: MacStadium, MacinCloud, GitHub Actions `macos` runner)
- **Node.js 18+** on that Mac
- An Apple Developer account ($99/yr) for device installs / TestFlight

## Steps (run on the Mac, inside `app-store-package/`)

```bash
# 1. Install JS deps (Capacitor + the HealthKit plugin declared in package.json)
npm install

# 2. Create the iOS project (first time only)
npx cap add ios

# 3. Copy the current web build (www/index.html is the whole app) into the iOS shell
npx cap sync ios

# 4. Open in Xcode
npx cap open ios
```

## In Xcode (one-time setup)
1. Select the **App** target → **Signing & Capabilities** → set your Team.
2. Click **“+ Capability”** → add **HealthKit**. (This adds the entitlement.)
3. Open **App/App/Info.plist** and add these two keys (required or the app crashes on the
   permission prompt):

```xml
<key>NSHealthShareUsageDescription</key>
<string>21 reads your steps, heart rate and sleep from Apple Health so your dashboard fills in automatically. You can always enter values manually instead.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>21 does not write to Apple Health today; this permission is reserved for future features.</string>
```

4. (Recommended) In **App/App/capacitor.config.json** confirm `appId` is
   `com.recisource.app` and `appName` is `21` (already set in this repo's
   `capacitor.config.json`, which `cap sync` copies).

5. Run on a **real device** (HealthKit does not work in the Simulator's Health app the way
   real data does — the Simulator has an empty Health store you can add samples to manually).

## How the app uses it
- On the **Today** screen, the caption under the health tiles becomes
  *“Tap here to sync steps, sleep & heart rate from Apple Health”* when running natively.
  Tapping it triggers permission request + sync.
- The bridge calls `CapacitorHealthkit.requestAuthorization` (read-only: `steps`,
  `heartRate`, `sleepAnalysis`) and `queryHKitSampleType` for each metric, then writes the
  values into the same state the manual steppers edit — so manual editing keeps working.
- Every call is wrapped in try/catch; failures fall back to a toast and manual entry.

## Updating the app later
Whenever the web app changes: rebuild `www/index.html` (the build script on the Windows
machine produces it), copy it here, then on the Mac run `npx cap sync ios` and re-archive.

## TestFlight
Product → Archive → Distribute App → App Store Connect → TestFlight. HealthKit apps must
declare the usage strings above; App Review also expects the app to function when the user
denies Health permission (it does — manual entry).
