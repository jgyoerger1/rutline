# Rutline on Google Play

The Android release follows the App Store release. Most of the calendar time is Google's, not ours, so the
account steps start first.

## Start now (Jordan, account steps; nothing in the repo depends on them yet)

1. **Google Play Console account**: https://play.google.com/console → Create developer account → **Yourself**
   (personal) → pay the one-time **$25** → identity verification (government ID, a phone number and an address;
   Google says up to a week, usually a day or two). An organization account needs a D-U-N-S number instead.
2. **The 14-day rule.** A personal account opened after November 2023 cannot publish to production until the app
   has run a **closed test with at least 12 testers opted in for 14 consecutive days**. Line up 12 people with an
   Android phone and a Gmail address now; the clock starts when the first closed-test build goes out and every
   tester has to stay opted in for the whole stretch. An organization account skips this.
3. **Google Play Developer API**: in the Play Console, Setup → API access → link a Google Cloud project, then create
   a **service account** with the Play Console roles "View financial data" and "Manage orders and subscriptions".
   Download its JSON key. RevenueCat and the upload workflow both use it; you upload the JSON into RevenueCat and
   into the GitHub secret yourself (`load-secrets.mjs` gets a Play section), the same way the Apple keys went in.

## What gets built in the repo (Claude, once the account exists)

- `npm install @capacitor/android && npx cap add android` → `android/` (Gradle project, committed like `ios/`).
  `npm run android:assets` generates the icon set and the plain-pine launch screen from `resources/`.
- `src/lib/iap.ts`: `IAP_CONFIGURED` accepts Android with `VITE_REVENUECAT_ANDROID_KEY` (a `goog_` public key, repo
  variable). The Pro sheet copy switches to Google Play wording (charged to your Google account, manage in
  Play Store → Subscriptions, Google's terms link instead of Apple's EULA). The purchase flow itself is the same
  RevenueCat call.
- Android back button closes sheets before it leaves the app (`@capacitor/app` `backButton`); status bar colour
  is already set in `src/lib/native.ts`.
- `.github/workflows/android.yml` on `ubuntu-latest` (JDK and the Android SDK are preinstalled): builds
  `dist-native/`, runs `cap sync android`, `gradlew bundleRelease`, signs the `.aab` with the upload key, and on a
  manual run uploads it to the **internal** track with the service account (`fastlane supply` or the
  `r0adkll/upload-google-play` action).
- Secrets: `ANDROID_UPLOAD_KEYSTORE_BASE64`, `ANDROID_UPLOAD_KEYSTORE_PASSWORD`, `ANDROID_UPLOAD_KEY_ALIAS`,
  `PLAY_SERVICE_ACCOUNT_JSON_BASE64`.
- Signing: Play App Signing is mandatory for new apps, so Google holds the app key and we only need an **upload
  key**. It is made in the signing folder with OpenSSL (a self-signed cert, 30-year validity; Play rejects upload
  certificates that expire before October 2033) packed into a PKCS12 keystore, which Gradle accepts directly.
  No Java needed on this machine.
- Store screenshots: `tools/play-shots.mjs` at 1080 × 2340 (9:16), plus the 1024 × 500 feature graphic and the
  512 × 512 icon from `resources/`.
- Listing text: `store/listing.md` gains a Play section (short description 80 chars, full description 4000, with
  the Play version of the subscription paragraph).

## Play Console setup (Jordan, with click paths when we get there)

1. Create the app (name Rutline, free, app not game, default language en-US), then **Set up your app** checklist:
   privacy policy URL, app access (the demo account), ads (none), content rating (IARC questionnaire: no
   violence, no UGC; hunting is fine), target audience **18 and over** (keeps it out of the Families policy),
   news app no, data safety form (the same data types as the Apple label: email, precise location, photos,
   user content, user id, purchase history; all for app functionality, encrypted in transit, deletable by the
   user), government app no, financial features no, health no.
2. Store listing: title (30), short description (80), full description (4000), icon, feature graphic,
   at least two phone screenshots.
3. Upload the first `.aab` to **Internal testing** (up to 100 testers by email, live in minutes, no review).
   Subscriptions can only be created after a build with the billing permission has been uploaded, so this
   comes first.
4. Monetize → Products → Subscriptions → create `rutline_pro_year` → base plan `yearly`, auto-renewing, 1 year,
   US $19.99 → activate. Setup → License testing → add your Gmail so purchases use Google's test cards.
5. RevenueCat → Project → Apps → **+ New app → Play Store**: package `com.jordanyoerger.rutline`, upload the
   service-account JSON, copy the `goog_` public key → GitHub repo variable `VITE_REVENUECAT_ANDROID_KEY` →
   attach the Play product to the existing `rutline_pro` entitlement and the Annual package.
6. Closed testing track with the 12 testers for 14 days → **Apply for production access** (Google asks a few
   questions about the test) → Production release → review, usually a few days for a new app.
