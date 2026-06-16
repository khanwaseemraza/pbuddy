# Running PBuddy natively (iOS / Android)

The app runs on **web** in Expo today. Native phone auth + push use
`@react-native-firebase`, which needs a **development build** (a prebuilt native
app) — **not Expo Go**. Everything is wired; you just build & run.

## Prerequisites
- **Android:** Android Studio + an emulator (or a USB device). Free.
- **iOS:** macOS + Xcode (simulator is free; a physical device / TestFlight needs a
  paid Apple Developer account — that's PBD-75/76, not needed to run on a simulator).
- Node 24, repo deps installed (`npm install` at root, then `cd app && npm install`).

## What's already configured
- Firebase native apps registered (bundle id **`uk.co.pbuddy`**): `app/google-services.json`
  (Android) + `app/GoogleService-Info.plist` (iOS), referenced from `app.json`.
- Config plugins: `@react-native-firebase/app|auth|messaging`, `expo-build-properties`
  (iOS static frameworks). Platform code: `src/lib/firebase.native.ts` (auth + Firestore),
  `src/lib/push.native.ts` (FCM token registration).

## Run it
```bash
cd app
npx expo run:android      # builds + installs the dev build on an emulator/device
# or, on macOS:
npx expo run:ios
```
The first build runs `expo prebuild` (generates the native projects) and compiles —
a few minutes. Subsequent JS changes hot-reload like normal.

## Phone auth on a device/emulator
- Real numbers: native reCAPTCHA/Play Integrity attestation is handled by the OS —
  no web reCAPTCHA needed.
- For repeatable testing without SMS, add a **test phone number** in Firebase Console
  → Authentication → Sign-in method → Phone → "Phone numbers for testing", then sign
  in with that number + its fixed code.

## Push notifications
- On first sign-in the app asks for notification permission, gets its FCM token, and
  registers it (`POST /devices/register`). Booking transitions then push to the device
  (see `api/src/lib/push.ts`). The API runtime SA has FCM send permission.

## Android store builds (Play Store — EAS)
A Play Store account is available, so you can build a Play-uploadable bundle:
```bash
cd app
npm i -g eas-cli && eas login          # free Expo account
eas build --profile production --platform android   # -> signed .aab (EAS keystore)
eas submit  --profile production --platform android # uploads to Play internal track
```
Profiles live in `app/eas.json` (development = dev client APK, preview = internal APK,
production = signed AAB). This is the start of epic **E18 (Android Production Launch)**.

## Notes
- **Expo Go will NOT work** (it can't load native Firebase modules). Use `expo run:*`.
- `google-services.json` / `GoogleService-Info.plist` are Firebase client config (not
  secrets — security is enforced by Firestore rules + the cost-sharing DB invariants +
  App Check later, PBD-62).
- Store distribution (TestFlight / Play) is PBD-74/75/76 and needs the paid developer
  accounts.
