# Remy for iPhone and Android

The apps in `ios/` and `android/` are [Capacitor](https://capacitorjs.com) shells around the live site, https://remyai.org (`capacitor.config.ts`). Each deploy of `main` reaches the apps right away, with no app-store update. You only release a new app version when native code, icons or plugins change.

- App ID / bundle ID: `org.remyai.app`
- Native-only code: `client/src/lib/native.ts`. On the web it does nothing.
- Icons and splash screens: sources in `mobile/assets/`. Run `npm run app:assets` to regenerate them.
- Offline screen: `mobile/www/offline.html`.
- To point a build at another server (e.g. a preview), set `REMY_APP_URL=https://… npx cap sync` before you build.

## What the app does differently from the website

| Thing | In the app |
|---|---|
| Google / LinkedIn / Microsoft / Apple sign-in | Opens in the system browser sheet, because Google blocks sign-in inside embedded web views. It then returns to the app through `org.remyai.app://auth?code=…`, and the site finishes sign-in as usual. |
| Downloads (resume PDF/Word, .ics, data export) | Open the share sheet (Save to Files, Drive, Mail…), because phone web views can't save blob links. |
| Links to other sites (postings, employers) | Open in the in-app browser sheet, so Remy stays open behind them. |
| Android back button | Goes back through Remy's pages, then closes the app. |
| Email sign-in links | Still open in the phone's browser. The 6-digit email code works inside the app. |

## One-time setup (team)

1. **Supabase:** Authentication → URL Configuration → Redirect URLs → add `org.remyai.app://auth`. Until you do this, social sign-in in the app falls back to the site URL and finishes in the browser instead of the app.
2. **Apple:** an Apple Developer account ($99/year). In Xcode (`npm run app:ios`), choose the team under Signing & Capabilities, then Product → Archive → upload to App Store Connect.
3. **Google Play:** a Play Console account ($25 one-time). In Android Studio (`npm run app:android`): Build → Generate Signed App Bundle, then upload the `.aab`. Keep the upload key safe and never commit it.

## Building and releasing

- **Android app** (`.github/workflows/mobile.yml`): runs on every change to the app files. It builds the APK, opens it on an Android emulator and fails if Remy's page doesn't appear, which catches a black or blank screen.
- **iPhone app** (`.github/workflows/mobile-ios.yml`): a simulator build. It runs only when `ios/` changes, or when started from the Actions tab, because macOS machines use up Actions minutes 10 times faster.
- **Test releases:** push a branch named `app-release/<version>`, e.g. `git push origin HEAD:app-release/0.1.3`, after raising `versionCode` and `versionName` in `android/app/build.gradle`. `.github/workflows/mobile-release.yml` builds the APK and publishes it under Releases as `app-v<version>` (a pre-release).
- **Signing:** test builds are signed with `android/test-signing.jks` (password in `android/app/build.gradle`), so each version installs over the last. That key is public, so it is for test builds only. The Google Play upload key must be a separate key kept out of the repo, e.g. as a GitHub secret.
- **Locally:** Node 20+, then `npm ci` and `npm run app:android` (needs Android Studio) or `npm run app:ios` (needs a Mac with Xcode 16+).

## App review notes

Apple can reject apps that are "just a website" (guideline 4.2). Remy's case rests on native sign-in, the native share sheet for files, and the offline screen. Push notifications for deadlines would strengthen it and are the natural next native feature.
