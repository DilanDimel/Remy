# Remy native app (owners preview)

The real iPhone and Android app, built with [Expo](https://expo.dev) (React Native). It replaces the Capacitor shell in `ios/` and `android/` (which only loads remyai.org) once the team releases it. Until then it is **owners only** (`appOpenFor` in `src/lib/rules.ts`): anyone else who signs in sees "The new app is almost here" and a link to the website.

- Same server and data as the website: it calls `https://remyai.org/api/...` and imports types and pure helpers from `../shared`.
- The website's look: colours from `src/lib/tokens.ts` (generated from `client/src/index.css`; regenerate it when the website's tokens change), Scholar Remy in the outfit the student picked (`src/components/scholarSvg.ts`).
- Native tab bar (Liquid Glass on iOS, Material on Android) with the website's pages: Home, My Path, Resume, Jobs, More. Remy is the floating fox above the tabs; he opens his chat from any page.
- The website's rules for who sees what (`src/lib/rules.ts`, using `shared/features.ts` and `shared/beta.ts`): sign-in, the beta list, the beta terms, setup, then the app. Feature releases from Admin → Beta → Feature releases show up on the next refresh (pull down, or come back to the app). Owners switch Owner / Student and the theme in More; both are saved on the account, so the website follows.
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

With an Expo account and `EXPO_TOKEN` set: `npx eas-cli@latest init` (first time), then `npx eas-cli@latest update --branch preview`. Nothing here publishes to the App Store or Google Play.

**After every merge that touches `native/`, publish it:** `cd native && npx eas-cli@latest update --branch preview --message "<PR title>"`. Phones only get what is published; a merge alone changes nothing on them. Publishing needs Deme's OK.

Judge the look on a preview build (`npx eas-cli@latest build --profile preview`), not Expo Go: Expo Go adds its own floating gear over the headers and can run a stale update.

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

Keep signing keys and the Play service-account key in EAS or GitHub secrets, never in the repo. The app still only opens for owners (`appOpenFor` in `src/lib/rules.ts`). Opening it to everyone and giving store reviewers a way to sign in are team decisions to make before the first review.

Already set for review: the microphone and speech recognition messages iOS shows before voice chat, no export-compliance question on each upload (Remy only uses standard HTTPS), and **More → Delete account**, which opens Account & data, where students can download their data or delete everything (both stores require deleting an account from inside the app).
