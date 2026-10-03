# Shipping Rutline to the App Store

The native app is the same web code inside a Capacitor shell. GitHub's macOS runners build it, so you do not need a Mac. What you do need is an Apple Developer account and about an hour of clicking through Apple's portal once. After that, every release is one button in the Actions tab.

## What is already in the repo

- `capacitor.config.ts`, `ios/` (the Xcode project), `resources/` (icon and splash sources) and `scripts/build-native.mjs`.
- `.github/workflows/ios.yml`: the **compile** job runs on every push and proves the app builds (unsigned, no Apple account needed). The **testflight** job is manual and needs the secrets below.
- `fastlane/Fastfile`: archives with your distribution certificate and uploads to TestFlight.
- `public/privacy.html`: the privacy policy App Review asks for, live at https://jordanyoerger.com/rutline/privacy.html.
- In-app account deletion (Settings → Account → Danger zone), which Apple requires for apps with sign-in.

## 1. Apple Developer Program

Enroll at https://developer.apple.com/programs/enroll/ ($99/year, individual is fine). Approval can take a day or two. Note your **Team ID** (Membership details page, a 10-character code).

## 2. Register the app

1. https://developer.apple.com/account/resources/identifiers → **+** → App IDs → App.
2. Description `Rutline`, Bundle ID **Explicit**: `com.jordanyoerger.rutline`. No capabilities needed yet. Register.
3. https://appstoreconnect.apple.com → My Apps → **+** → New App: iOS, name `Rutline`, primary language English, bundle ID the one above, SKU `rutline`. Create.

## 3. Distribution certificate (made on Windows with OpenSSL)

Git for Windows ships OpenSSL, so run these in Git Bash, in any folder you will keep private:

```bash
openssl genrsa -out rutline-dist.key 2048
openssl req -new -key rutline-dist.key -out rutline-dist.csr -subj "/emailAddress=you@example.com/CN=Jordan Yoerger/C=US"
```

1. https://developer.apple.com/account/resources/certificates → **+** → **Apple Distribution** → upload `rutline-dist.csr` → download `distribution.cer`.
2. Convert to a password-protected bundle the runner can import:

```bash
openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM
openssl pkcs12 -export -inkey rutline-dist.key -in distribution.pem -out rutline-dist.p12 -name "Apple Distribution" -legacy
```

Pick a password when asked; you will store it as a secret. (If `-legacy` is rejected by your OpenSSL, drop it.)

## 4. Provisioning profile

https://developer.apple.com/account/resources/profiles → **+** → **App Store Connect** (under Distribution) → App ID `com.jordanyoerger.rutline` → pick the certificate you just made → name it `Rutline App Store` → Generate → Download `Rutline_App_Store.mobileprovision`. The name you typed is the `IOS_PROFILE_NAME` secret.

## 5. App Store Connect API key

https://appstoreconnect.apple.com/access/integrations/api → **+** → name `GitHub Actions`, access **App Manager** → Generate. Download the `.p8` file (one chance only) and note the **Key ID** and the **Issuer ID** shown at the top.

## 6. GitHub secrets

Repo → Settings → Secrets and variables → Actions → **Secrets** → New repository secret, one each:

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

## 8. App Review

In App Store Connect fill in the listing: screenshots (6.7" and 6.5" iPhone), description, keywords, support URL (the GitHub issues page works), privacy policy URL (`https://jordanyoerger.com/rutline/privacy.html`), and the App Privacy questionnaire (location, photos, email and user content, all "linked to the user" and used only for app functionality). Age rating: no restricted content; hunting is fine. Pick the TestFlight build, submit. First reviews take one to three days. Two things reviewers check for sign-in apps: account deletion inside the app (done) and, if you ever add Google sign-in, Sign in with Apple alongside it.

## Updating later

Bump `version` in `package.json`, push, run the workflow with upload ticked. The build number is the GitHub run number, so it always increases.

## Known native gaps

- Invite links (`#/join/CODE`) open the website, not the app, until universal links are configured. The app also answers `rutline://join/CODE`. Pasting the code in Settings → Camps works everywhere.
- The camera torch is not controllable from the WebView; use a flashlight for night tracking.
- Android: Capacitor can add it with `npx cap add android`; a Play build needs a signing keystore and the Play Console ($25 once). Say the word when you want it.
