# Rutline on Google Play

The Android release follows the App Store release. The repo side is built (2026-11-03): the Android project,
the signing setup, the GitHub workflow and the store graphics. What remains is Google's account work, which
only Jordan can do, and the two keys that come out of it.

## What exists in the repo

- `android/`: the Capacitor Android project (Gradle, Capacitor 8.5.2, minSdk 24, target 36), committed like
  `ios/`. `app/src/main/assets/public` is the web build copied in by `cap sync` and is ignored.
  Adaptive launcher icons from `resources/` (`npm run android:assets`); the launch background is plain pine
  (`drawable/splash.xml`) because `Splash.tsx` draws the lockup, same as iOS. Location and camera permissions
  are declared; Capacitor bridges the web geolocation and camera prompts to Android's.
- `app/build.gradle`: `versionName` from `-PversionName` (package.json version) and `versionCode` from
  `-PversionCode` (the Android workflow's run number). The release build is signed with the Play **upload
  key** when `RUTLINE_UPLOAD_KEYSTORE` points at the keystore, unsigned otherwise.
- `.github/workflows/android.yml` on `ubuntu-latest` (JDK 21): builds `dist-native/`, runs `cap sync android`,
  `gradlew bundleRelease`, keeps `app-release.aab` as the `Rutline-aab` artifact. First run 41663334270 was
  green. A manual run with "Upload to Google Play" ticked sends the bundle to the **internal** track
  (`r0adkll/upload-google-play`), status draft by default.
- Signing: `C:\Dev\rutline-secrets\make-upload-key.sh` made the upload key with OpenSSL (RSA 2048, PKCS12,
  alias `upload`, certificate good to 2056; Play rejects upload certificates that end before October 2033).
  Play App Signing keeps the real app key, so losing the upload key is recoverable through Play support.
  `load-secrets.mjs` in the same folder now has an `android` group.
- App code: `src/lib/iap.ts` reads `VITE_REVENUECAT_ANDROID_KEY` on Android; the Pro sheet's wording follows
  the store (Google account, Play Store › Payments and subscriptions, no Apple EULA link). Without the key the
  Android build runs fully unlocked as "native preview", so a closed test can start before billing exists.
  The hardware back button closes the open sheet, then returns to the map, then backgrounds the app.
- Store assets in `store/play/`: nine phone screenshots at 1080 × 1920 (`tools/play-shots.mjs`), the 1024 × 500
  feature graphic and the 512 × 512 icon (`tools/feature-graphic.mjs`). Listing text is the Google Play
  section of `store/listing.md`.

Not yet exercised on a real Android phone: the back button, status-bar insets, the geolocation and camera
prompts, and RevenueCat on Play. The first internal-test install is where those get checked.

## Jordan, in order

1. **Play Console account**: https://play.google.com/console → Create developer account → **Yourself**
   (personal) → one-time **$25** → identity verification (government ID, phone, address; Google says up to a
   week, usually a day or two). An organization account needs a D-U-N-S number instead.
2. **Load the upload key into GitHub.** In Git Bash:
   ```
   cd /c/Dev/rutline-secrets && node load-secrets.mjs --dry-run
   ```
   The `android` group should show three `ok` lines and `not yet` for the service account. Then run it
   without `--dry-run`. The next push (or Actions → Android app → Run workflow) produces a signed bundle;
   the run's "Report" step says "signed with the upload key".
3. **Create the app**: Play Console → **Create app** → name `Rutline`, default language English (United
   States), **App**, **Free** → accept the declarations → Create.
4. **First upload, by hand** (Google's API refuses a package it has never seen): download `Rutline-aab`
   from the latest green Android run (Actions → the run → Artifacts) and unzip it. Play Console →
   **Testing → Internal testing → Create new release** → keep **Play App Signing** on (default) → upload
   `app-release.aab` → release name as suggested → Save. Add yourself under **Testers** (an email list) and
   the test link appears; the app installs from it within a few minutes, no review.
5. **Set up your app** (Dashboard checklist). Every answer is in the Google Play section of
   `store/listing.md`: privacy policy URL, app access with the demo account, ads No, content rating (IARC,
   answer No throughout, Everyone), target audience 18+, data safety, the other declarations No.
6. **Store listing**: Grow → Store presence → Main store listing. Paste the name, short and full description,
   upload `store/play/icon-512.png`, `feature-graphic.png` and the screenshots. Contact email is required and
   public; use an alias on jordanyoerger.com.
7. **Service account for uploads from GitHub**: Play Console → **Setup → API access** → link or create a Google
   Cloud project → **Create new service account** (the link opens Google Cloud) → name `rutline-upload` → role
   **Service Account User** is enough on the Cloud side → back in Play Console, **Grant access** → app
   permissions: Rutline → account permissions **Release to testing tracks** and **Manage testing tracks and
   edit tester lists** → Invite user. In Google Cloud → the service account → **Keys → Add key → JSON**; the
   file downloads. Move it into `C:\Dev\rutline-secrets\` with a name starting `play-service-account` and run
   `node load-secrets.mjs` again. From then on Actions → Android app → Run workflow → tick upload sends the
   bundle to the internal track.
8. **Subscription**: Monetize → Products → **Subscriptions → Create subscription** → product id
   `rutline_pro_year`, name `Rutline Pro` → **Add base plan** `yearly`, auto-renewing, 1 year, price US $19.99
   → Activate. (The product page only unlocks after a bundle with the billing permission has been uploaded,
   which step 4 does; RevenueCat's plugin adds the permission.) Setup → **License testing** → add your Gmail so
   test purchases use Google's test cards.
9. **RevenueCat**: project → Apps → **+ New app → Play Store** → package `com.jordanyoerger.rutline` → upload
   the same service-account JSON → the app's **Public API key** starts `goog_` → GitHub → Settings → Secrets and
   variables → Actions → **Variables** → New: `VITE_REVENUECAT_ANDROID_KEY`. Then Products → import
   `rutline_pro_year` → attach it to the `rutline_pro` entitlement and the Annual package of the current
   offering. Push or re-run the workflow: that build sells Pro on Android, and the webhook already handles it.
10. **The 14-day rule**: a personal account opened after November 2023 cannot publish to production until the
    app has run a **closed test with at least 12 testers opted in for 14 consecutive days**. Testing → Closed
    testing → create a track, add the 12 testers' Gmail addresses, promote the internal release to it. After
    the 14 days, **Apply for production access** (a short questionnaire about the test), then Production →
    create release → review, usually a few days for a new app.

## Running the Android workflow

- Every push that touches app paths builds the bundle (compile check; signed once the secrets exist).
- Actions → **Android app** → Run workflow → tick **Upload to Google Play** → status **draft** until the
  Play Console checklist is complete, **completed** after. Or by API:
  ```
  POST /repos/jgyoerger1/rutline/actions/workflows/android.yml/dispatches  {"ref":"main","inputs":{"upload":"true","status":"draft"}}
  ```
- A new version: bump `version` in package.json and push; the run number becomes the versionCode, so every
  run is a higher code than the last and Play never sees a duplicate.
