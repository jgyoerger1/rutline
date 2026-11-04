# Shipping Rutline to the App Store

The native app is the same web code inside a Capacitor shell. GitHub's macOS runners build it, so you do not need a Mac. What you do need is an Apple Developer account and about an hour of clicking through Apple's portal once. After that, every release is one button in the Actions tab.

## What is already in the repo

- `capacitor.config.ts`, `ios/` (the Xcode project, iPhone only), `resources/` (icon and splash sources) and `scripts/build-native.mjs`.
- `.github/workflows/ios.yml`: the **compile** job runs on every push and proves the app builds (unsigned, no Apple account needed). It runs on `macos-26` runners because App Store Connect rejects uploads built with anything older than Xcode 26, and the first step fails loudly if the runner's Xcode is too old. The **testflight** job is manual and needs the secrets below.
- `fastlane/Fastfile`: archives with your distribution certificate and uploads to TestFlight.
- `public/privacy.html`, live at https://jordanyoerger.com/rutline/privacy.html, and `public/support.html`, live at https://jordanyoerger.com/rutline/support.html. App Review asks for both links.
- In-app account deletion (Settings → Account → Danger zone), which Apple requires for apps with sign-in.
- `store/screenshots/6.3-captioned/`: the App Store screenshot set, 1206 × 2622 (the Dynamic Island medium class Apple requires; it scales them to every other iPhone), with a caption band above each capture. `store/art/`: the iOS 27 product-page header (3840 × 1646) and search-results artwork (3840 × 2560). Regenerate with `node tools/store-shots.mjs`, `node tools/store-frames.mjs` and `node tools/store-art.mjs` while `npm run dev` is running; raw captures and the 6.9-inch set are not committed.

## Before the first build

1. **Esri imagery key.** Esri's terms require an API key for imagery inside an app. Create a free ArcGIS Location Platform account at https://location.arcgis.com, make an API key with the **Basemaps** privilege, and add it as a repo *variable* (not secret) named `VITE_ESRI_API_KEY` under Settings → Secrets and variables → Actions → Variables. Both workflows read it; without it the app falls back to the open endpoint, which is fine for development only. The free tier is 2 million tiles a month.
2. **Supabase sign-up emails.** Supabase's built-in mailer sends only a few emails an hour, so with email confirmation on, a launch-day rush leaves people stuck at "check your email". Either turn confirmation off (Authentication → Sign In / Providers → Email → Confirm email) or connect a custom SMTP provider first (Authentication → Emails → SMTP settings; Resend and Brevo have free tiers). Done 2026-11-03: Resend custom SMTP is connected, see "Submitting to the App Store" step 2.

## 1. Apple Developer Program

Enroll at https://developer.apple.com/programs/enroll/ ($99/year, individual is fine). Approval can take a day or two. Note your **Team ID** (Membership details page, a 10-character code).

## 2. Register the app

1. https://developer.apple.com/account/resources/identifiers → **+** → App IDs → App.
2. Description `Rutline`, Bundle ID **Explicit**: `com.jordanyoerger.rutline`. No capabilities needed yet. Register.
3. https://appstoreconnect.apple.com → My Apps → **+** → New App: iOS, name `Rutline`, primary language English, bundle ID the one above, SKU `rutline`. Create. If the name is taken, try `Rutline: Deer Hunting Maps`.

## 3. Distribution certificate (made on Windows with OpenSSL)

All signing material lives in `C:\Dev\rutline-secrets` (outside the repo, never commit it). It already holds the private key, the signing request, the certificate bundle and two helper scripts; this is how it was made, for the day a certificate expires (October 2027):

```bash
cd /c/Dev/rutline-secrets
openssl genrsa -out rutline-dist.key 2048
MSYS_NO_PATHCONV=1 openssl req -new -key rutline-dist.key -out rutline-dist.csr -subj "/CN=Jordan Yoerger/C=US"
```

1. https://developer.apple.com/account/resources/certificates → **+** → **Apple Distribution** → upload `rutline-dist.csr` → download `distribution.cer` into the folder.
2. Convert to the bundle the runner imports. Write the password with Node, not a shell redirect: Git Bash leaves a carriage return at the end of the file, OpenSSL bakes it into the bundle, and the Mac then reports "passphrase not correct" for the clean password.

```bash
openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM
node -e "require('fs').writeFileSync('p12-password.txt', require('crypto').randomBytes(18).toString('base64'))"
P=$(cat p12-password.txt) openssl pkcs12 -export -inkey rutline-dist.key -in distribution.pem -out rutline-dist.p12 -name "Apple Distribution" -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256 -passout env:P
```

## 4. Provisioning profile

https://developer.apple.com/account/resources/profiles → **+** → **App Store Connect** (under Distribution) → App ID `com.jordanyoerger.rutline` → pick the certificate you just made → name it `Rutline App Store` → Generate → Download `Rutline_App_Store.mobileprovision`. The name you typed is the `IOS_PROFILE_NAME` secret.

## 5. App Store Connect API key

https://appstoreconnect.apple.com/access/integrations/api → **Team Keys** tab (not Individual Keys, which have no Issuer ID) → **+** → name `GitHub Actions`, access **App Manager** → Generate. Download the `.p8` file (one chance only) into `C:\Dev\rutline-secrets`. Put the **Key ID** and the **Issuer ID** (the UUID at the top of the Team Keys page) into `ids.txt` in that folder:

```text
APPLE_TEAM_ID=TUJ4ARM9Q5
IOS_PROFILE_NAME=Rutline App Store
APPSTORE_KEY_ID=
APPSTORE_ISSUER_ID=
```

Test the key against Apple before uploading anything (prints only the result):

```powershell
cd C:\Dev\rutline-secrets; node check-apple-key.mjs
```

## 6. GitHub secrets

The loader in the secrets folder encrypts every file and value and uploads all eight in one go, so nothing is pasted anywhere:

```powershell
cd C:\Dev\rutline-secrets; node load-secrets.mjs
```

Run it again whenever a file changes; existing secrets are updated in place. By hand, the equivalent is Repo → Settings → Secrets and variables → Actions → **Secrets** → New repository secret, one each:

| Secret | Value |
|---|---|
| `APPLE_TEAM_ID` | your 10-character Team ID |
| `IOS_DIST_CERT_P12_BASE64` | `base64 -w0 rutline-dist.p12` (Git Bash) |
| `IOS_DIST_CERT_PASSWORD` | the password you chose |
| `IOS_PROVISIONING_PROFILE_BASE64` | `base64 -w0 Rutline_App_Store.mobileprovision` |
| `IOS_PROFILE_NAME` | `Rutline App Store` |
| `APPSTORE_KEY_ID` | Key ID from step 5 |
| `APPSTORE_ISSUER_ID` | Issuer ID from step 5 |
| `APPSTORE_PRIVATE_KEY` | `base64 -w0 AuthKey_XXXX.p8` |

## 7. Build and upload

Actions → **iOS app** → Run workflow → tick **Upload to TestFlight** → Run. Fifteen to twenty minutes later the build appears in App Store Connect → TestFlight. Add yourself as an internal tester, install the TestFlight app on your phone, and you are running the native build. Friends can be added as testers by email (up to 100 internal testers, no review needed).

Test on the phone before submitting: location, the blood camera, a photo on a pin, sign-in and sync, property lines, and the rack tracer.

## 8. Submitting to the App Store

Four things gate the submission, and all four are account steps only Jordan can do. Do them in this order;
the first one needs a fresh build afterwards.

1. **Esri key** ("Before the first build" above). The iOS build bakes `VITE_ESRI_API_KEY` in at build time, so
   once the variable exists, bump the version and run one more TestFlight upload. That build is the one to submit.
2. **Sign-up and password-reset email.** DONE 2026-11-03. Supabase custom SMTP sends through Resend as
   `rutline@jordanyoerger.com` (host `smtp.resend.com`, port `465`, user `resend`, password = the Resend API key
   named `Supabase`), the email rate limit is 30 an hour and Confirm email is on; a password-reset mail landed in
   Gmail's inbox. If it ever has to be redone: Resend → **Domains → Add domain** → type the domain carefully
   (the first attempt was `jordanyeorger.com`, which fails with "domain not found") → Resend shows a DKIM TXT
   (`resend._domainkey`) and two CNAMEs (`send` and `rsend`, both to `*.forge.rmta.net`; a CNAME cannot share
   its name with an MX or TXT record, so delete any old `send` MX first) → add them at Squarespace
   (account.squarespace.com/domains → the domain → DNS → Custom records) → **Verify**. The API key belongs to
   the account, not the domain, so it survives re-adding the domain.
3. **Demo account for the reviewer.** In the app, create an account with an address you control (a
   plus-address such as `you+review@...` is fine), confirm it, and save three or four pins and a trail near
   your home ground. Its email and password go into App Store Connect's review section only, never the repo.
4. **Support contact.** `public/support.html` points at GitHub issues. Reviewers accept that, but an email
   address on the page is safer and friendlier. If you want one, pick an alias that forwards to you (an address
   on jordanyoerger.com, not your personal mailbox) and it goes on the page.

Then App Store Connect, top to bottom. The text for every field is in `store/listing.md`.

1. **App Information** (left sidebar, under General): Name, Subtitle, Primary and Secondary category, Content
   Rights, then **Age Rating → Edit**, answer the questionnaire, Done. **Save** at the top right.
2. **Pricing and Availability**: Price Schedule → **Free**; Availability → Edit → **United States** only. Save.
3. **App Privacy**: Privacy Policy URL, then **Get Started** → the data types listed in `store/listing.md` →
   **Publish**.
4. **Subscriptions** (under Monetization): open the Rutline Pro group → Rutline Pro must read **Ready to
   Submit**. If it says *Missing Metadata*, open it: a localization (display name and description), a price,
   and under Review Information the screenshot `store/review/pro-sheet.png` with its note. Save.
5. **iOS App → the version → Prepare for Submission** (the version string must equal `package.json`):
   drag the ten screenshots into the **6.9-inch** slot; Promotional Text, Description, Keywords, Support URL,
   Marketing URL; **Build → + → the latest build** (the one with the Esri key); **In-App Purchases and
   Subscriptions → + → Rutline Pro** (a subscription is only reviewed alongside a version, and the first one
   has to ride with the first submission); Copyright; **App Review Information**: Sign-in required → the demo
   email and password, your contact name, phone and email, and the Notes from `store/listing.md`;
   **Version Release → Manually release this version**. Save.
6. Top right **Add for Review** → clear any red items it lists → **Submit to App Review**. Status goes
   *Waiting for Review* → *In Review* → *Ready for Distribution*, usually within one to three days. A rejection
   arrives in the Resolution Center with a message; most first-round rejections ask for a clarification or a
   metadata change, not a rebuild. Reply there.
7. On approval: iOS App → **Release This Version**. The subscription goes live with it, and the listing is
   searchable within about a day.

After approval, two loose ends: the web keeps `VITE_PRO_PREVIEW=1` until the Stripe link exists
(`supabase/README.md` §8), which does not touch the App Store version; and in App Store Connect → App
Information → **App Store Server Notifications**, paste the URL RevenueCat shows under Project → Apps → App
Store → *Apple Server to Server notification URL* into both Production and Sandbox, so cancellations and
renewals reach the webhook within minutes instead of at the next app launch.

## Rutline Pro in the native app

The web app sells Pro through a Stripe Payment Link (`supabase/README.md` §8). Apple does not allow that inside an iOS app, so the native build sells the same season pass through StoreKit with RevenueCat (`supabase/README.md` §9, `src/lib/iap.ts`, webhook `supabase/functions/revenuecat-webhook`). Until the repo variable `VITE_REVENUECAT_IOS_KEY` exists, every native build runs fully unlocked (`NATIVE_PREVIEW` in `src/lib/pro.ts`; repo variable `VITE_PRO_PREVIEW=1` does the same for every build, web included, during testing): TestFlight testers get the whole app and Apple's beta reviewer never meets a locked feature with no way to buy it. Before submitting to the App Store: accept the Paid Apps agreement, create the subscription product and the RevenueCat project, add the variable, build again and buy once with a sandbox tester. Submitting with locked features and no way to buy them is a 2.1 rejection, so either ship with the key or ship fully unlocked. For an auto-renewable subscription the buy screen must show the price, the term, Apple's standard EULA link and the privacy policy link; the Pro sheet does.

## Hidden for launch

These are in the code but switched off for the first store version, each with a one-line switch:

- The landowner **phone web search** ("Find a number"): `SHOW_PHONE_SEARCH` in `src/components/map/LandownerContact.tsx`. Highest review risk, least launch value. Manual phone entry with Call and Text stays.
- The field guide's **"coming next" cards**: removed from `FieldGuideView.tsx`. Apple's completeness rule rejects placeholder content; add the installments back when they exist.
- The **OpenStreetMap street layer**: removed from the map. OSM's tile servers do not allow app traffic at scale. Saved settings that pointed at it fall back to satellite.

The blood-camera torch button already hides itself on iPhone, because the WebView does not expose torch control.

- Trophy Center's **AI read**: `SHOW_AI_READ` in `src/components/trophies/TrophyView.tsx`. Needs an Anthropic key and the `score-buck` function deployed (`supabase/README.md` §7). Field judging and the tracer work without it. If you ever turn it on, put the Anthropic sentence back in the privacy policy.

## Updating later

Bump `version` in `package.json`, push, run the workflow with upload ticked. The build number is the GitHub run number, so it always increases.

## Known native gaps

- Invite links (`#/join/CODE`) open the website, not the app, until universal links are configured. The app also answers `rutline://join/CODE`. Pasting the code in Settings → Camps works everywhere.
- The camera torch is not controllable from the WebView; use a flashlight for night tracking.
- Android: the plan, prerequisites and click paths are in `docs/google-play.md`.
