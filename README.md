# Rutline

Map. Predict. Track.

A whitetail hunting web app that installs on a phone like a native one. Everything you pin stays on your device; the only network calls are for weather, map tiles and place search.

## What it does

- **Map.** Satellite (Esri), USGS topo and street layers. Drop stands, blinds, trail cameras, scrapes, rubs, bedding, food, water, funnels, access points and blood sign. Draw deer trails, entry and exit routes. Drag a pin to move it. Attach photos (camera or library, several at once); trail-cam pulls sort by the capture date in their EXIF. Each stand carries the winds it hunts, and when you select it the map draws your scent cone from the live wind.
- **Wind and weather.** Live from Open-Meteo (NOAA, ECMWF and DWD models blended), refreshed every 30 minutes while open. Wind compass that shows where your scent goes, 48-hour strip with wind arrows, 72-hour barometer with the 29.90 to 30.40 inHg band marked, and the week ahead.
- **HuntCast.** An hour-by-hour 0 to 100 deer-movement index for the next week, with the kickers and drags behind every hour, best morning, midday and evening windows, the rut phase for your latitude with a season ribbon, and a "where to sit" list that checks every stand's winds against the forecast. The model and its sources are documented inside the app under "How HuntCast scores an hour".
- **Blood light.** The rear camera with every colour but blood stripped to gray and blood painted red, yellow or green. Low, High and Soil sensitivities, a hit counter, tick and vibration alerts where the device allows, torch where the browser allows, hold-to-peek at the real view, and "Mark blood here" which drops a pin with the frame you were looking at so the trail builds on the map. "Try it on a photo" lets you test sensitivity at the kitchen table.
- **Property lines.** Parcel boundaries for all of Ohio from the state's OGRIP parcel service, with site address, acres, land use and the owner's tax mailing address. Owner names are layered in where the county publishes them (Summit, Stark and Geauga so far). Tap a parcel for the record, save the landowner to a stand or access pin, and generate a permission letter to copy, share or print. Any other county's ArcGIS parcel layer can be added in Settings with a field mapping. Phone numbers are not public anywhere; the mailing address is the contact.
- **Camps.** A shared map for a lease or a crew: create a camp, hand out its 8-character code or invite link, and share any pin or trail into it from the pin's sheet. Members see shared pins with a brass ring and the sharer's name, can edit them, and see the photos on them. Private pins stay private. Owners can rename, rotate the code and remove members.
- **Accounts and sync.** Optional Supabase backend: sign in with email and password, a one-time code, or Google/Apple when enabled, and every pin, line, photo, landowner and setting syncs to the account and to any other device. Offline-first: the device stays usable with no signal and catches up later. Setup is in `supabase/README.md`; without it the app runs on-device only.
- **Offline.** Installed as a PWA, the app shell, fonts, the last forecast and every map tile you have looked at are cached.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173. `npm run build` writes a production bundle to `dist/`; `npm run typecheck` runs TypeScript.

## Deploy to GitHub Pages

Push to `main`. The workflow in `.github/workflows/deploy.yml` builds with Vite and publishes `dist/` to GitHub Pages. In the repository settings, set **Pages > Build and deployment > Source** to **GitHub Actions** once. The site serves from `https://<user>.github.io/<repo>/`; the workflow passes the repository name as the Vite base path automatically.

## Put it on an iPhone

1. Open the GitHub Pages URL in Safari.
2. Share, then **Add to Home Screen**.
3. Launch from the icon. Allow location and camera when asked.

Safari limits: no vibration and no torch control from a web page, so the tracker relies on its tick sound and the on-screen badge. Camera access needs HTTPS, which GitHub Pages provides.

### The App Store build

The app is plain web code, so it can be wrapped with [Capacitor](https://capacitorjs.com) for a native iOS shell with haptics, torch and App Store distribution. That path needs a Mac with Xcode and an Apple Developer account:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/haptics
npx cap init Rutline com.yourname.rutline --web-dir dist
npm run build && npx cap add ios && npx cap sync ios && npx cap open ios
```

Then set the camera and location usage strings in `Info.plist`, swap `navigator.vibrate` for `@capacitor/haptics`, and archive from Xcode.

## Stack

Vite, React 19, TypeScript, Tailwind CSS 4, Framer Motion, Phosphor icons, Leaflet with react-leaflet, Dexie (IndexedDB), SunCalc, vite-plugin-pwa. Fonts are Geist and Geist Mono, self-hosted.

## Data sources

- Weather: [Open-Meteo](https://open-meteo.com) (free, no key)
- Imagery: Esri World Imagery; Topo: USGS National Map; Streets: OpenStreetMap
- Place search: Open-Meteo geocoding; reverse geocoding: BigDataCloud client API

## How the HuntCast model was built

Commercial forecasts (HuntWise HuntCast, DeerCast, BestHuntingTime) describe the same inputs without publishing weights: barometric pressure level and trend, temperature against the previous day, wind band, precipitation and its edges, cloud cover, moon, time of day and rut phase as a multiplier. GPS-collar research (Mississippi State, Texas A&M-Kingsville, Penn State, Maryland) finds that rut timing and dawn/dusk dominate buck movement and that weather and moon are weak signals. Rutline's weights follow that evidence: time of day and rut carry the index, pressure trend, a real temperature drop and a workable wind are the next tier, and the moon is deliberately small. Every factor and its point range is listed in `src/lib/huntcast.ts` and in the app.
