# Phone app test, Nov 26 2026 (lead AI, for Demetre's AI)

Dilan (Nov 26): Demetre owns the app now, so the lead made **no `native/` changes** from this test (one small fix was tried on a branch and reverted; it's described below so you can take it or leave it). Fixing is yours.

## How it was tested
- Local server: `OR_DB_PATH=/tmp/db OWNER_EMAILS=owner@test.dev npm run dev`; sign in with `POST /api/auth/email/start` + `/verify` (the code prints in the server log), `POST /api/resume/sample`, then a seed script (run from `script/` so tsx aliases work) that writes jobs, to-dos, calendar items, applications and a chat with action rows (`did`) through `loadWorkspace`/`saveWorkspace`, turns on open access and sets releases to match live.
- App: `cd native && npx expo export -p web`, served by a tiny Node server that proxies `/api` to the local server. Screens shot with Playwright at 344x882, 360x780, 375x667, 393x852, 430x932, owner and student, light and dark: Home, My Path, Resume, Jobs, More, Calendar, Progress, Rewards, Account, Remy chat.
- **Not covered:** a real phone. On the web build `NativeTabs` draws its tab bar at the TOP, so the bottom bar, floating fox position, notch/safe areas and keyboard couldn't be judged. No JavaScript errors, nothing overflowed sideways.

## Findings
1. **Career time weekday pills wrap** (Account, Calendar, setup PlanStep; `src/components/CareerTime.tsx`). At 344-430 px "Sat" (sometimes "Fri Sat") wraps onto a line alone. Tried fix: one even row, each day a `Pressable` with `flex: 1`, height 36, radius 18, font 13 (fits at 344 px). Also "Pick a day" wraps to two lines at 344 px: `numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}` on `text-career-time`.
2. **Chat action rows cut the time** (`src/components/DidRows.tsx`): "Added "Deloitte coffee chat" to your calendar, tomorrow …" hid "2:30 PM" at 2 lines. Already raised to `numberOfLines={3}` in #505 (merged before the handoff).
3. **Floating fox over Home's "Remy says" button** at 360 px: the fox sits on the right end of "Review resume" while the page is at the top. Check on a real phone (its height above the tab bar differs on device).
4. Fine as is: Home "Remy noticed" shows the full sentence (the website now matches it, #505); Jobs, Rewards, Progress, Calendar, Account read well at every size; students see "The new app is almost here" because the app is owners-only.

## Android emulator on Dilan's laptop (ready except one step)
Installed Nov 26 without admin: Android SDK at `C:\Users\Dilan\AppData\Local\Android\Sdk` (cmdline-tools 23.0, emulator 37.3.10, platform-tools/adb 37.0.3, platform android-36, build-tools 36.0.0, system image android-36 Google Play x86_64), `ANDROID_HOME` + PATH set for the user, AVD **Remy_Pixel_API36** (Pixel 8, 4 GB RAM, GPU on). Node.js 26.13.1 LTS and Temurin JDK 17.0.21 in the user folder (`JAVA_HOME` = 17; plain `java` still finds JDK 25 first on PATH).
**Still needed (admin, Dilan):** PowerShell as administrator → `Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All -NoRestart` → restart. Without it the x86_64 emulator won't start (AMD Ryzen 5 7535HS, virtualization is on in firmware). Then `emulator -avd Remy_Pixel_API36` and install the latest preview APK with `adb install`.
