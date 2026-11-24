# Remy native app (owners preview)

The real iPhone and Android app, built with [Expo](https://expo.dev) (React Native). It replaces the Capacitor shell in `ios/` and `android/` (which only loads remyai.org) once the team releases it. Until then it is **owners only**: anyone else who signs in sees "The new app is almost here" and a link to the website.

- Same server and data as the website: it calls `https://remyai.org/api/...` and imports types and pure helpers from `../shared`.
- Native tab bar (Liquid Glass on iOS, Material on Android): Today, Path, Remy, Jobs, You.
- Two looks for owners to compare, switched on the You tab: **A · Calm** (Apple-style lists) and **B · Soul** (Remy's hero card, the road, swipe cards).
- Sign-in: the 6-digit email code (Google's sign-in page doesn't work inside apps).
- Screens not rebuilt natively yet (resume, interview, progress, settings) open the website in a signed-in sheet (`src/app/web.tsx`). In that sheet, outside links open in the in-app browser, mail and phone links open their own apps, and downloads open the share sheet (`src/lib/files.ts`; the site hands files over from `download()` in `client/src/lib/native.ts`).

## Run it

```bash
cd native
npm ci
npx expo start          # scan the QR code with Expo Go on your phone
npm run check && npm test
```

`EXPO_PUBLIC_API_URL=http://<your-ip>:5000` points the app at a local server instead of remyai.org.

## Put it on a phone without the app stores

With an Expo account and `EXPO_TOKEN` set: `npx eas-cli@latest init` (first time), then `npx eas-cli@latest update --branch preview`. Open the update in Expo Go from its QR code. Nothing here publishes to the App Store or Google Play.

## Build for the App Store and Google Play

`eas.json` has two build profiles. Neither one publishes anything by itself.

- **preview:** an internal build (an Android APK, or an iPhone build for registered test phones) that gets `eas update --branch preview` updates.
- **production:** the store build (an iPhone `.ipa`, an Android `.aab`) on the `production` update channel. EAS keeps the build numbers (`appVersionSource: remote`) and raises them on every production build. The version people see is `version` in `app.json`.

Once the Apple Developer and Play Console accounts exist:

```bash
npx eas-cli@latest build --platform all --profile production   # EAS asks for the Apple and Google signing details the first time and keeps them
npx eas-cli@latest submit --platform ios --profile production   # to TestFlight
npx eas-cli@latest submit --platform android --profile production  # to Play's internal testing track, as a draft
```

Keep signing keys and the Play service-account key in EAS or GitHub secrets, never in the repo. The app still only opens for owners (`isOwnerView` in `src/lib/session.tsx`). Opening it to everyone and giving store reviewers a way to sign in are team decisions to make before the first review.

Already set for review: the microphone and speech recognition messages iOS shows before voice chat, no export-compliance question on each upload (Remy only uses standard HTTPS), and **You → Delete account**, which opens Account & data, where students can download their data or delete everything (both stores require deleting an account from inside the app).
