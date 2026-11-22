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
