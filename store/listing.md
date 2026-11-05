# App Store listing, paste-ready

Every field below is sized for App Store Connect's limit. Copy each block as is.
Nothing here is private; review credentials and contact details go into App Store Connect only.

## App Information (General → App Information)

**Name** (30 max, 26 used)

```
Rutline: Deer Hunting Maps
```

**Subtitle** (30 max, 30 used)

```
Property lines, wind, rut days
```

**Primary category**: Sports. **Secondary category**: Navigation.

**Content Rights**: "Yes, it contains, shows or accesses third-party content" and "I have all necessary rights".
(Esri imagery under its API key terms, USGS and PAD-US are public domain, Open-Meteo is CC BY, county parcel records are public records.)

**Age Rating**: answer None / No to every item. Camps are private, invite-only shared maps, not a public feed,
so "user-generated content" and "messaging" are No. Result: 4+.

**License Agreement**: keep Apple's standard EULA (the app links to it from the Pro sheet).

## Pricing and Availability

Price: **Free** (Pro is the subscription). Availability: **United States** only for the first release; the
property, public-land and hunt-unit data are all US sources and the weather labels are in °F and mph.

## Version page (iOS App → 1.x.x → Prepare for Submission)

**Promotional text** (170 max, 166 used; can be changed any time without a review)

```
Know which stand to sit and why: live wind on every pin, owner-of-record property lines, public land, LiDAR terrain and a daily deer-movement forecast. Free to start.
```

**Description** (4000 max, about 2,200 used)

```
Rutline is a whitetail hunting map that tells you which stand to sit and why.

THE MAP
• Pins for stands, blinds, cameras, scrapes, rubs, beds, food, funnels and more, each with photos and notes.
• Pick the winds a stand can be hunted in, then see at a glance which stands are right for today's wind.
• Satellite and USGS topo basemaps, LiDAR hillshade from the USGS 3D Elevation Program, and a search box for any town or coordinates.
• Property lines with the owner of record from public county records, public land and walk-in areas, and state hunting units.
• Record trails, entry routes and blood trails as you walk them.

WIND AND WEATHER
• Live wind for your home ground and the next 48 hours, hour by hour.
• Pressure trend, temperature and sunrise and sunset with your state's legal light.

HUNTCAST
• A daily deer-movement forecast built from the rut calendar, cold fronts, pressure, wind and the moon, scored for dawn and dusk.

AFTER THE SHOT
• Blood light: the camera brightens blood on the ground while you track.
• A field guide for field dressing, judging a buck on the hoof and scoring the rack, with a score sheet that does the math.

CAMPS
• Share pins and trails with your hunting partners in a private, invite-only camp.

Pins, trails and photos save on your phone with no account, and work with no signal. Sign in to back them up, carry them to a new phone and share them into camps.

RUTLINE PRO
Pro unlocks slope and 5-foot contours, landowner details and a written permission letter, offline map areas, unlimited blood light, the full HuntCast forecast, Trophy Center, the whole field guide and camps. Property lines, hillshade and the two-day forecast stay free.

Rutline Pro is an auto-renewing subscription: $19.99 per year, charged to your Apple ID when you confirm the purchase. It renews at the same price unless you cancel at least 24 hours before the year ends. Manage or cancel it any time in Settings › Apple ID › Subscriptions.
Terms of use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy policy: https://jordanyoerger.com/rutline/privacy.html

Property lines come from public records and are not a survey. Confirm a boundary with the landowner before you hunt it.
```

**Keywords** (100 max, 99 used; commas, no spaces)

```
whitetail,buck,rut,scouting,landowner,parcels,public land,topo,lidar,blood,tracking,treestand,score
```

"Deer", "hunting", "property lines" and "wind" are already in the name and subtitle, which Apple indexes, so they
are not repeated. No competitor names: Apple rejects trademarks in keywords.

**Support URL**: `https://jordanyoerger.com/rutline/support.html`
**Marketing URL**: `https://jordanyoerger.com/rutline/`
**Privacy Policy URL** (under App Privacy): `https://jordanyoerger.com/rutline/privacy.html`
**Copyright**: `2026 Jordan Yoerger`

**What's New in This Version** (first release)

```
Rutline's first App Store release.

• Stand map with wind-aware pins, photos, notes and trails
• Property lines with the owner of record, public land and hunting units
• LiDAR terrain, satellite and USGS topo
• Live wind, 48-hour forecast and HuntCast, the daily deer-movement forecast
• Blood light for tracking after the shot
• Field guide and rack score sheet
• Camps for sharing a map with your hunting partners
```

**Screenshots** (Previews and Screenshots): upload the ten captioned PNGs in `store/screenshots/6.3-captioned/`
(1206 × 2622, the "iPhone with Dynamic Island, medium display" class Apple has required since late 2026; it scales
them to every other iPhone) in their numbered order. The first three show in search results, so the map, the wind
pitch and the landowner shot lead. If App Store Connect also offers a 6.9-inch slot, `store/screenshots/6.9-captioned/`
is the same set at 1320 × 2868. Regenerate: `node tools/store-shots.mjs` (raw captures, dev server running) then
`node tools/store-frames.mjs` (captions); add `--class=6.9` to both for the larger set. The blood-light shot comes from `node tools/blood-shot.mjs` instead (Chrome plays `store/source/blood-trail.jpg` as the camera, so the light is running in the picture), then `node tools/store-frames.mjs --only=blood-light`.

**Header** (Header tab): `store/creative/header-rut-3840x1646.png`, the 21:9 artwork at the top of the product page
on iOS 27: "Know when to sit, not just where." with the rut ribbon (Pre-rut to 2nd rut, Chasing lit, today's
dawn/dusk reading) over the live map, the buck at the left edge. That is the differentiator no other hunting app
leads with. `header-3840x1646.png` is the land-line version ("Know the ground before you hunt it."). **Search Results**
(Search Results tab): `store/creative/search-3840x2560.png`, the 3:2 artwork shown beside the app in search
instead of the screenshot row: "See whose land you're on." with two phones. Both from `node tools/store-art.mjs`
(dev server running), with the text inside Apple's safe area because the edges are cropped on some devices.
Brand-only alternates (buck and lockup, no headline) are `header-lockup-3840x1646.jpg` and
`search-lockup-3840x2560.jpg` from `node tools/store-art-buck.mjs`. Apple reviews these with the version.

## App Privacy (General → App Privacy)

Click **Get Started**, answer "Yes, we collect data from this app", then add exactly these data types.
For every one of them: **Linked to the user: Yes. Used for tracking: No. Purpose: App Functionality.**

| Data type | Where it goes |
|---|---|
| Contact Info → Email Address | Supabase sign-in; also the hunter email typed for the permission letter (settings sync to the account) |
| Contact Info → Name | the camp display name, and the hunter name typed for the permission letter (settings sync to the account) |
| Contact Info → Phone Number | the hunter phone typed for the permission letter, if entered (settings sync to the account) |
| Location → Precise Location | home ground to Open-Meteo and BigDataCloud for weather and a place label; pin coordinates sync to Supabase when signed in |
| User Content → Photos or Videos | pin photos sync to Supabase storage when signed in |
| User Content → Other User Content | pins, trails, notes |
| Identifiers → User ID | Supabase account id, also sent to RevenueCat so Pro follows the account |
| Purchases → Purchase History | Apple receipt checked by RevenueCat |

Everything else is **Not collected**. Then click **Publish** at the top right; the label goes live with the app.

## App Review Information (bottom of the version page)

- **Sign-in required**: on. Enter the demo account's email and password (create it in the app first, with a
  couple of pins and a trail saved so sync has something to show).
- **Contact information**: your name, phone and email. These are private to Apple.
- **Notes** (paste):

```
Rutline works with no account: tap "Use without an account on this device" on the sign-in screen and everything except backup, sync and camps is available. The demo account above is signed in to a map with a few pins near Parkman, Ohio.

Rutline Pro is an auto-renewable yearly subscription sold through StoreKit; the sandbox purchase works on the Pro sheet (Settings → Rutline Pro → Buy Pro) and "Restore purchases" is on the same sheet.

Property lines and owner-of-record names come from the same public county parcel services that onX Hunt and HuntStand show. Rutline displays them for the parcel the hunter taps and stores nothing unless the hunter saves a note. It does not look up phone numbers or combine records from other sources.

Location is used only while the app is open, for the map and the home-ground weather. The camera is used for the blood light and pin photos; frames are processed on the device.
```

**Version Release**: choose **Manually release this version**, so approval does not put it live before you are ready.

## Google Play (Play Console → Grow → Store presence → Main store listing)

Same app, Google's limits. Graphics live in `store/play/` (`node tools/play-shots.mjs` and
`node tools/feature-graphic.mjs` regenerate them with the dev server running).

**App name** (30 max, 26 used): `Rutline: Deer Hunting Maps`

**Short description** (80 max, 80 used)

```
Property lines, landowners, wind-aware stands, LiDAR terrain and a rut forecast.
```

**Full description** (4000 max, about 2,150 used). The Apple description with Google's billing wording; Play
has no EULA link and the privacy policy is a separate field.

```
Rutline is a whitetail hunting map that tells you which stand to sit and why.

THE MAP
• Pins for stands, blinds, cameras, scrapes, rubs, beds, food, funnels and more, each with photos and notes.
• Pick the winds a stand can be hunted in, then see at a glance which stands are right for today's wind.
• Satellite and USGS topo basemaps, LiDAR hillshade from the USGS 3D Elevation Program, and a search box for any town or coordinates.
• Property lines with the owner of record from public county records, public land and walk-in areas, and state hunting units.
• Record trails, entry routes and blood trails as you walk them.

WIND AND WEATHER
• Live wind for your home ground and the next 48 hours, hour by hour.
• Pressure trend, temperature and sunrise and sunset with your state's legal light.

HUNTCAST
• A daily deer-movement forecast built from the rut calendar, cold fronts, pressure, wind and the moon, scored for dawn and dusk.

AFTER THE SHOT
• Blood light: the camera brightens blood on the ground while you track.
• A field guide for field dressing, judging a buck on the hoof and scoring the rack, with a score sheet that does the math.

CAMPS
• Share pins and trails with your hunting partners in a private, invite-only camp.

Pins, trails and photos save on your phone with no account, and work with no signal. Sign in to back them up, carry them to a new phone and share them into camps.

RUTLINE PRO
Pro unlocks slope and 5-foot contours, landowner details and a written permission letter, offline map areas, unlimited blood light, the full HuntCast forecast, Trophy Center, the whole field guide and camps. Property lines, hillshade and the two-day forecast stay free.

Rutline Pro is an auto-renewing subscription: $19.99 per year, charged to your Google account when you confirm the purchase. It renews at the same price unless you cancel at least 24 hours before the year ends. Manage or cancel it any time in the Play Store app under Payments and subscriptions.

Property lines come from public records and are not a survey. Confirm a boundary with the landowner before you hunt it.
```

**Graphics**: app icon `store/play/icon-512.png` (512 × 512), feature graphic `store/play/feature-graphic.png`
(1024 × 500), phone screenshots `store/play/01-map.png` … `09-lidar-terrain.png` (1080 × 1920, 9:16; Play takes
two to eight, so drop 06 if you want exactly eight). Upload 01-map first.

**Category**: Application, **Sports**. **Tags**: Hunting, Maps & Navigation. **Contact email**: required and shown
to the public on the listing, so use an alias on jordanyoerger.com, not a personal mailbox.
**Privacy policy** (App content → Privacy policy): `https://jordanyoerger.com/rutline/privacy.html`

**App content questionnaire** (the "Set up your app" checklist):

- **App access**: "All or some functionality is restricted" → add the demo account's email and password with the
  note "Tap 'Use without an account on this device' to skip sign-in; the account shows sync and camps."
- **Ads**: No.
- **Content rating**: IARC. Category "Utility, Productivity, Communication, or Other". Answer No throughout: the
  blood light shows the phone's own camera, not depicted violence. Result: Everyone.
- **Target audience**: 18 and over only (keeps the app out of the Families policy).
- **News app**: No. **COVID-19 contact tracing**: No. **Government app**: No. **Financial features**: No.
  **Health**: No.
- **Data safety**: Yes, collects data. Same six types as the Apple label, all "Collected", not shared, encrypted
  in transit, deletable (Settings → account → delete), purpose App functionality:
  Personal info → Email address · Location → Precise location (optional: the app works without it) ·
  Photos and videos → Photos · App activity → Other user-generated content (pins, trails, notes) ·
  App info and performance: none · Device or other IDs: none · Purchase history (under Financial info) · User IDs
  (under Personal info → User IDs). Nothing is used for advertising or analytics.
