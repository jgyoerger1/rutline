# Rutline — CLAUDE.md

Whitetail hunting app ("Map. Predict. Track."): stand map with pins/photos/trails, live wind and weather,
HuntCast deer-movement index, blood-light camera, property lines with landowner of record, public land and
hunt units, terrain, field guide, Trophy Center, camps (shared maps), optional accounts + sync.
Built and owned by Jordan. **This repo is PUBLIC** — never commit secrets, account IDs, business numbers or
personal contact details. Business case lives in a separate private repo (rutline-business).

## Where it is live

- Web (PWA): https://jordanyoerger.com/rutline/ — GitHub Pages via Actions (`.github/workflows/deploy.yml`).
  `jgyoerger1.github.io/rutline` redirects there. Privacy/support pages: `public/privacy.html`, `public/support.html`.
- iOS: Capacitor shell, bundle id `com.jordanyoerger.rutline`, iPhone only. In **TestFlight** (1.0.0 first upload
  2026-10-25; 1.1.0 uploaded 2026-10-28 with in-app purchase; 1.1.1 and **1.1.2** uploaded 2026-10-30). Not yet submitted to App Store review.
- Version lives in `package.json` (`1.1.2`); iOS build number = GitHub Actions run number.

## Pricing / tiers

Free app + **Rutline Pro**, $19.99 for 12 months.
- Web: Stripe Payment Link (one-time 12-month pass) -> `supabase/functions/stripe-webhook` writes `entitlements.pro_until`.
- iOS: StoreKit via RevenueCat (`src/lib/iap.ts`), auto-renewable yearly product `rutline_pro_year`, entitlement
  `rutline_pro`, webhook `supabase/functions/revenuecat-webhook`. The native build must never show the Stripe link (Apple 3.1.1).
- Pro gates (`src/lib/pro.ts`, `ProFeature`): slope + 5 ft contours (hillshade stays FREE), landowner details
  (owner/mailing/phone) + permission letter, offline areas, blood light beyond 5 camera-minutes/day, HuntCast beyond
  `FREE_FORECAST_DAYS` (2), Trophy Center, field guide beyond field-dressing, camps.
- **Right now Pro is open to everyone on the web** via repo variable `VITE_PRO_PREVIEW=1` (friends test outside
  TestFlight). The iOS build reads `VITE_PRO_PREVIEW_IOS` (unset) so TestFlight sells Pro (sandbox = free).
  To start selling on the web: delete `VITE_PRO_PREVIEW` and redeploy.
- `NATIVE_PREVIEW` (pro.ts) unlocks native builds automatically when no RevenueCat key is in the build.

## Stack and layout

Vite 8 + React 19 + TypeScript 7 + Tailwind 4 + Framer Motion + Phosphor icons + Leaflet/react-leaflet 5 +
Dexie (IndexedDB) + SunCalc + vite-plugin-pwa; Supabase (optional backend); Capacitor 8 with SPM (no CocoaPods).

- `src/App.tsx`, `src/components/` — views: `map/` (MapView, ParcelLayer/Sheet, LetterSheet, LandownerContact,
  TerrainLayer, OverlayLayer, OfflineSheet, GoToSheet), `weather/`, `huntcast/`, `tracker/` (blood light),
  `guide/` (scrollytelling field guide engine: ScrollGuide.tsx + diagram.tsx; one `<topic>.ts` + Diagram + Guide
  per installment, registry in FieldGuideView), `trophies/`, `pro/`, `more/` (account, camps, custom parcel source),
  `Splash.tsx`, `motion.tsx` (motion primitives + Wordmark).
- `src/lib/` — `db.ts` (Dexie `rutline`, all UI reads via `live*` helpers that hide tombstones), `sync.ts`,
  `cloud/` (supabase | mock backend), `camps.ts`, `pro.ts`, `iap.ts`, `huntcast.ts` + `rut.ts` (model),
  `weather.ts` (Open-Meteo), `parcels.ts` + `parcelRegistry.ts` + `parcelDiscovery.ts`, `overlays.ts` +
  `publicLand.ts` + `huntUnits.ts`, `basemaps.ts` + `offline.ts`, `score.ts` + `scoreCard.ts`, `native.ts`.
- `supabase/schema.sql` (idempotent; tables with jsonb `data`, RLS, photos bucket, camps RPCs, `entitlements`),
  `supabase/functions/{stripe-webhook,revenuecat-webhook,score-buck}`, `supabase/README.md` (full setup §1-§9).
- `ios/` Xcode project (committed, ~18 MB), `resources/` icon/splash sources, `fastlane/` (TestFlight lane),
  `scripts/build-native.mjs`, `tools/` (headless-Chrome image generators), `store/` (App Store screenshots/art),
  `assets/` (brand collateral .webp sources), `docs/app-store.md` (Apple setup + review notes).

## Commands (verified against package.json / workflows)

Requires Node 22+ (CI uses 22; local dev used 24) and npm.

```bash
npm install
npm run dev            # http://localhost:5173 (strictPort, host: true)
npm run typecheck      # tsc --noEmit  (there is no unit-test suite; typecheck + build are the gate)
npm run build          # -> dist/ with base /rutline/ (override with VITE_BASE)
npm run preview
npm run build:native   # -> dist-native/ with base / and VITE_NATIVE=1
npm run ios:sync       # build:native + npx cap sync ios (works on Windows)
npm run ios:assets     # regenerate icons/splash from resources/
node tools/store-shots.mjs   # App Store screenshots 1320x2868 -> store/screenshots/ (dev server running)
node tools/pro-shot.mjs      # Pro sheet review screenshot -> store/review/ (dev server running)
node tools/pro-image.mjs     # 1024 subscription image -> store/pro-subscription-1024.png
node tools/splash.mjs        # launch screen source (app icon alone on pine) -> resources/splash*.png, then npm run ios:assets
node tools/og-card.mjs       # link-preview image -> public/brand/og.jpg
```

Local env: copy `.env.example` to `.env.local` (git-ignored) for Supabase/Stripe/RevenueCat/preview values.
Without Supabase values the app runs on-device only. Dev mock backend: `localStorage.rutline.cloud='mock'`
(any 8+ char password, code 000000); dev Pro override `localStorage.rutline.pro='1'`; mock Pro `rutline.mock.pro='1'`.

## Deploy and iOS release (no Mac needed — GitHub Actions macOS runners, not Codemagic)

- Web: push to `main` -> deploy.yml builds with repo **variables** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_AUTH_PROVIDERS`, `VITE_ESRI_API_KEY`, `VITE_STRIPE_PAYMENT_LINK`, `VITE_PRO_PRICE`, `VITE_PRO_PREVIEW`).
- iOS: `ios.yml` "compile" job (unsigned, `macos-26`, Xcode >= 26 guard) runs on pushes touching app paths.
  TestFlight: Actions -> "iOS app" -> Run workflow -> tick "Upload to TestFlight" (runs `fastlane ios beta`
  with 8 repo **secrets**: `APPLE_TEAM_ID`, `IOS_DIST_CERT_P12_BASE64`, `IOS_DIST_CERT_PASSWORD`,
  `IOS_PROVISIONING_PROFILE_BASE64`, `IOS_PROFILE_NAME`, `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, `APPSTORE_PRIVATE_KEY`).
  Can also be dispatched via the GitHub REST API with `inputs.upload=true`.
- New release: bump `version` in package.json, push, run the workflow with upload ticked.
- Supabase: re-run `supabase/schema.sql` in the SQL editor after schema changes. Webhooks deploy with
  `--no-verify-jwt` (`supabase functions deploy stripe-webhook|revenuecat-webhook --no-verify-jwt`).

## Decisions and Jordan's preferences

- Design: pine/charcoal + bone + a **single ember-orange accent**; dividers, not cards; no emojis; Geist/Geist Mono
  self-hosted; Chakra Petch wordmark (RUT bone + LINE ember). Blood-colour swatches in the guide are the only
  exception to the single accent. Motion everywhere honours `prefers-reduced-motion`.
- Splash must be live staged elements (Jordan called a poster fade "cheap and clunky").
- Launch decision (2026-10-24): free app + Pro, **zero marketing spend**; launch iPhone first, Android later.
- Hidden for launch, one-line switches: `SHOW_PHONE_SEARCH=false` (map/LandownerContact.tsx), `SHOW_AI_READ=false`
  (trophies/TrophyView.tsx — Jordan asked to remove the AI read; `score-buck` never deployed; if re-enabled, restore
  the Anthropic sentence in privacy.html). Field-guide "coming next" cards removed (Apple completeness rule).
  OSM street layer removed (tile policy); settings migrate 'streets' -> 'satellite'.
- Never a home-grown unlock code in the iOS app (Apple 3.1.1); in-app purchase only.
- Wind compass arrow shows where scent CARRIES (needle rotates by the "from" bearing) — matches map chip + 48 h strip.
- Parcel sheet carries a not-a-survey disclaimer. Phone numbers are never looked up automatically (no free source;
  people-search deep links deliberately not built). Manual phone entry with Call/Text is fine.
- Flag hardware/account prerequisites (Apple, paid services, keys) BEFORE starting work that depends on them.
- Jordan follows step-by-step instructions in vendor dashboards; give numbered, exact click paths.

## Gotchas learned the hard way

- Leaflet panes must sit inside an `isolate z-0` wrapper or they cover every overlay; map uses `preferCanvas`.
- Parcels: fetch only at zoom >= 15 and view <= 3600 m; split a request that hits the 2000 cap into quadrants ONCE
  (unbounded splitting froze the tab at ~30k polygons). Condo stacks collapse into one parcel with `units`.
- Terrain (USGS 3DEP ImageServer): ONE viewport `exportImage` per moveend, not tiles (16 parallel tile exports
  queued 10-40 s and errored). Zoom gate 10.
- Offline tiles: workbox `tiles` CacheFirst needs `cacheableResponse {statuses:[0,200]}` to store opaque no-cors tiles.
- framer-motion: never `jump()` a `useSpring` value (it detaches from its source). Hidden/background browser
  panes throttle rAF, so springs/AnimatePresence stall in screenshots — verify via DOM probes, or reload directly at a hash.
- HMR can leave stale store module instances (e.g. missing share select) — reload before judging.
- `sync.ts`: `clearLocal()` must wipe the per-user cursors (`rutline.sync.cursor.<user>.<table>`).
- Supabase forbids deleting `storage.objects` inside SQL functions; the client deletes files via the Storage API first.
- `vite preview` of a production build: config sets base only on build, so pass `--base=/rutline/`
  (and `MSYS_NO_PATHCONV=1` in Git Bash). DEV hooks (`__rutline`, `__map`, `rutline.pro`) survive a build only with
  `NODE_ENV=development npx vite build` (`--mode development` alone does not flip DEV).
- The Claude browser pane cannot register service workers; test offline/SW in headless Chrome/Edge over CDP,
  and send network emulation to the service_worker target too.
- suncalc 2.x is ESM with named exports (`import * as SunCalc`).
- p12 password files written by a shell redirect can carry a trailing CR that OpenSSL bakes in ("passphrase not
  correct" on macOS) — write it with Node (`docs/app-store.md` §3). App Store Connect Issuer ID is the UUID on the
  **Team Keys** page; Individual keys have none.
- First Actions run on a new repo fails if deploy-pages runs before Pages is enabled; re-run failed jobs.
- RevenueCat webhook pasted in the Supabase dashboard editor once got doubled ("Identifier 'json' already declared").

## Land data reference (all public, keyless, CORS-checked 2026-10)

Source of truth is the code: `src/lib/parcelRegistry.ts` (statewide + curated county layers), `parcelDiscovery.ts`
(runtime county discovery: FCC census area API -> PASDA for PA -> ArcGIS Online search, probe for real owner names,
cache 30 d hit / 7 d miss), `huntUnits.ts` (39 states + OH/IN county regulation layers), `publicLand.ts` (PAD-US + walk-in).
- Ohio statewide (OGRIP, 6.3 M polygons, owner names STRIPPED, mailing address present, maxRecordCount 2000):
  `services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer/0`.
- Ohio counties with owner names: Summit `services3.arcgis.com/3Ukh5HzAdI6WZ3KP/.../TaxParcels_public/FeatureServer/0`,
  Stark `scgisa.starkcountyohio.gov/.../Auditor/StarkCountyParcels/FeatureServer/0`, Geauga
  `gcgis.geauga.oh.gov/parcel/rest/services/AzureParcels/Parcels/FeatureServer/0`, Portage
  `services.portageco.com/arcgis/rest/services/TaxParcel_GE/FeatureServer/0` (DeededOwner).
- Statewide owner names (free): AK, AR, CO (partial), CT, FL, ID (11 counties), MA, ME, MN (opt-in), MS (2022),
  MT, NC, ND, NV (2018), NY (partial), TN (86/95), VT, WI, WV, WY, IA (stale). Boundaries only: DE, HI, IN, MD, NE,
  NH, NJ (Daniel's Law), UT, VA, WA. None statewide: AL, AZ, GA, IL, KS, KY, LA, MI, MO, NM, OK, OR, PA, RI, SC, SD,
  CA, TX (TxGIO /query disabled; an identify-based path could unlock Texas).
- Quirks: ME/ND/WV owners via joined tables; UT deer-unit service name changes yearly; PA units need
  `wmu_status='Active'`; SD needs `Species='White-tailed Deer'`; AZ GMU server has an expired cert; OK needs a token.
- Phone numbers: no free API anywhere. Paid route if ever wanted: skip-trace API behind a Supabase edge function.
- Terrain: `elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage`
  (renderings "Hillshade Multidirectional", "Slope Map", "Preset 5ft Contour Interval").
- Weather: Open-Meteo forecast + geocoding; reverse geocode: BigDataCloud client API. Imagery: Esri (keyed
  endpoint when `VITE_ESRI_API_KEY` set, open endpoint for dev only), USGS topo.

## Open items

- Jordan: sandbox purchase of Pro on the 1.1.0 TestFlight build; "Not for sale yet" = Paid Apps agreement not Active.
- Before App Store submission: Paid Apps agreement, review notes + demo account (text in `docs/app-store.md` §8),
  decide when to drop `VITE_PRO_PREVIEW` on the web, Supabase email confirmation off or custom SMTP, Esri
  `VITE_ESRI_API_KEY` repo variable (ArcGIS Location Platform key) if not yet set, Stripe product/link/webhook for web sales.
- Known gap: an iOS purchase made while signed out reaches the account row only on the next renewal.
- Universal links not configured (invite links `#/join/CODE` open the website; app answers `rutline://join/CODE`).
- Ideas not built: hunt log / sightings calibration, Leaflet chunk splitting (main bundle large), vector antler mark,
  field guide installments (aging on the hoof, hanging/quartering), Android (`npx cap add android`).

## Not in the repo — bring separately

- iOS signing folder (kept outside the repo, next to it on the old machine): Apple Distribution private key + CSR,
  `distribution.cer`/`.pem`, `.p12` bundle + its password file, App Store provisioning profile (`.mobileprovision`),
  App Store Connect API key (`AuthKey_*.p8`), In-App Purchase key (`SubscriptionKey_*.p8`, used by RevenueCat),
  `ids.txt` (team/profile/key/issuer IDs), and two helper scripts: `load-secrets.mjs` (encrypts + uploads the 8
  Actions secrets using the GitHub token from Git Credential Manager) and `check-apple-key.mjs` (JWT test against
  App Store Connect). The distribution cert expires October 2027.
- `.env.local` with Supabase URL + publishable key and any Stripe/RevenueCat/preview values for local runs.
- Supabase Edge Function secrets live in Supabase (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `REVENUECAT_WEBHOOK_AUTH`; `ANTHROPIC_API_KEY` only if the AI read is ever enabled).
- Accounts: GitHub (repo variables + secrets), Apple Developer / App Store Connect, Supabase, RevenueCat,
  Stripe, ArcGIS Location Platform, the jordanyoerger.com DNS/Pages setup.
- Jordan's design skill `/design-taste-frontend-v1` and the Emil Kowalski skills (`/animate`, `/emil-design-eng`)
  lived in the old machine's Claude config, not in this repo.

## New machine notes

- Commit as Jordan's personal GitHub account (jgyoerger1) using its GitHub noreply address; set it repo-locally.
- Plain `git push` with Git Credential Manager should work; the old header-injection workaround was for a
  locked-down machine. `gh` CLI can be installed now (admin rights).
- `tools/*.mjs` default `CHROME` to `C:/Program Files/Google/Chrome/Application/chrome.exe`
  (`tools/og-card.mjs:8`, `tools/pro-image.mjs:10`, `tools/pro-shot.mjs:12`, `tools/store-shots.mjs:10`); set the
  `CHROME` env var if Chrome lives elsewhere. `puppeteer-core` is a devDependency, so no global install needed.
- `docs/app-store.md` lines 31, 66, 74 refer to the signing folder by an absolute old-machine path; read them as "the signing folder".
- `.claude/launch.json` (repo) starts `npm run dev` on 5173 for the preview pane.
