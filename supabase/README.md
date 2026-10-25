# Turning on accounts and sync

Rutline runs on the device until you connect a Supabase project. Once connected, people sign in, and their pins, lines, photos, landowners and settings sync to the account and back to any phone or browser. The front-end still ships from GitHub Pages; Supabase provides the database, sign-in and photo storage. About fifteen minutes.

## 1. Create the project

1. Sign up at https://supabase.com and create a new project. Pick the East US region and a strong database password (you will not need it again for this app).
2. In **Project Settings → API Keys**, copy the **Publishable key** (starts with `sb_publishable_`). On older projects it is listed under **Legacy API keys** as **anon** (starts with `eyJ`); either works, the publishable key is the current one. Never use a key labelled **secret** or **service_role** in the app. The **Project URL** (`https://xxxx.supabase.co`) is under **Project Settings → Data API**. The publishable/anon key is meant to be public; row-level security is what protects the data.

## 2. Create the tables

1. Open **SQL Editor → New query**.
2. Paste the whole of `supabase/schema.sql` from this repo and press **Run**. It creates the tables, the photo bucket, the security policies and the account-deletion function. It is safe to run again later.

## 3. Sign-in settings

In **Authentication → Providers → Email**:

- Leave **Enable email provider** on.
- For a handful of friends, turn **Confirm email** off. Supabase's built-in mailer sends only a few emails per hour, which is fine for password resets but not for a burst of sign-ups. If you later add your own SMTP (Resend, Postmark and the like have free tiers), turn confirmation back on.
- Optional: in **Email Templates → Magic Link**, add `{{ .Token }}` to the body so the "Email me a code" option shows a 6-digit code. Without it, people get a sign-in link instead, which also works in a browser but not from the installed home-screen app.

In **Authentication → URL Configuration**:

- **Site URL**: `https://jordanyoerger.com/rutline/`
- **Redirect URLs**: add `https://jordanyoerger.com/rutline/**` and `http://localhost:5173/**`

Optional Google sign-in: **Authentication → Providers → Google**, follow Supabase's steps to create OAuth credentials in Google Cloud, then set the `VITE_AUTH_PROVIDERS` variable below to `google`. Apple sign-in needs an Apple Developer account and is only required once the app is in the App Store.

## 4. Tell the build about the project

In the GitHub repo: **Settings → Secrets and variables → Actions → Variables → New repository variable**, add:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | the Project URL |
| `VITE_SUPABASE_ANON_KEY` | the publishable key (or legacy anon key) |
| `VITE_AUTH_PROVIDERS` | blank, or `google` |

Then **Actions → Deploy to GitHub Pages → Run workflow**, or push any commit. The next build shows the sign-in page.

For local development, create `.env.local` in the project root (it is git-ignored):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 5. After an app update

When the app gains features that need new tables or policies (camps did), re-run `supabase/schema.sql` the same way as step 2. It only adds what is missing.

## 6. First sign-in on a device that already has pins

Everything already on the device is uploaded into the account the first time you sign in. If a device was last used by a different account, the app asks whether to add its pins to the new account or start clean.

## How sync works

- Local IndexedDB stays the source of truth for the screen, so the app works with no signal.
- Every pin, line and photo has a stable UUID, a dirty flag and a tombstone. Edits push after a couple of seconds of quiet; pulls happen on sign-in, when the app comes to the foreground, when the connection returns, and every five minutes.
- Conflicts resolve last-write-wins by the device clock. Two people editing the same pin within seconds of each other is not a case this version handles beyond that.
- Photos upload once (full size and thumbnail) to a private bucket under the user's own folder. Other devices download thumbnails immediately and full images when opened.
- Settings sync as one document on the profile. "Use without an account" is a device choice and does not sync.
- Camps: a pin or trail shared into a camp carries the camp id; row-level security lets every member read and edit it, and only the owner hard-delete it. Photos follow their pin. Leaving a camp or being removed takes your shared rows back to private, and other members' devices drop rows they can no longer see on their next sync.

## Costs and limits

The free plan covers a few friends: 500 MB database, 1 GB photo storage, 50,000 monthly active users. Two things to know: a free project **pauses after seven days without traffic** and has to be restored from the dashboard, and the built-in mailer is rate-limited. The Pro plan ($25/month) removes the pause and raises the limits. Before charging anyone for the app, also budget for commercial weather data (Open-Meteo's paid plan) and a paid map-tile provider; the free sources Rutline uses are licensed for non-commercial use.

## Testing without a project

On a dev build (`npm run dev`), run `localStorage.setItem('rutline.cloud', 'mock')` in the browser console and reload. A fake backend stored in localStorage stands in for Supabase: any email with any 8-character password signs in, and the one-time code is `000000`. Remove the key to go back.

## 7. AI reads in Trophy Center (switched off in the app)

The button is hidden behind `SHOW_AI_READ` in `src/components/trophies/TrophyView.tsx`. Do the steps below first, then flip it on and add the Anthropic sentence back to `public/privacy.html`.

"AI read" on a buck sends the photo to a small server function, which asks Claude for a rough age and gross score. The function holds the Anthropic API key so the app never does. Until it is deployed, the button explains that reads are not switched on, and field judging and the tracer still work.

1. Get an API key at https://console.anthropic.com (Settings → API keys) and add a few dollars of credit. A read costs about two cents.
2. Deploy the function in `supabase/functions/score-buck/index.ts`. Either:
   - **Dashboard:** Edge Functions → Deploy a new function → name it `score-buck`, paste the file, keep **Verify JWT** on, deploy. Then Edge Functions → Secrets → add `ANTHROPIC_API_KEY`.
   - **CLI:** `supabase login`, `supabase link --project-ref lqktkqwfgbmqnetvbsfm`, `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`, `supabase functions deploy score-buck`.
3. Sign in on the phone and tap **AI read** on a buck.

Verify JWT means only signed-in users can spend reads. If reads ever need a cap, add a per-user daily count in a table and check it at the top of the function.

## 8. Rutline Pro (season pass)

The app is free. Pro is a 12-month pass that unlocks the terrain overlay, unlimited blood tracking, the full week of HuntCast, Trophy Center, the whole field guide and camps. It lives on the account in the `entitlements` table, which only the server can write.

1. **Run the Pro block** at the bottom of `schema.sql` in the SQL editor (the `entitlements` table and its read policy). Until it exists, nobody has Pro and the app treats that as normal.
2. **Give friends Pro by hand** with the `insert ... on conflict` snippet in the same block (Table Editor works too: add a row to `entitlements` with the user's id from Authentication → Users and a `pro_until` a year out). The app picks it up on its next check: sign-in, app open, or the "Check again" button on the Pro sheet.
3. **Sell it with Stripe** (free account, 2.9% + 30¢ per sale):
   - Products → add "Rutline Pro season pass", one-time, $19.99.
   - Payment Links → new link for that product. After payment, redirect to `https://jordanyoerger.com/rutline/?pro=1#/more`. Copy the link URL.
   - Add it as a repo *variable* `VITE_STRIPE_PAYMENT_LINK`. The app appends `client_reference_id` (the account id) and the email when it opens the link, which is how the sale finds the account.
   - Deploy the webhook: `supabase functions deploy stripe-webhook --no-verify-jwt` (or paste `supabase/functions/stripe-webhook/index.ts` in the dashboard and turn Verify JWT **off**, since Stripe calls it). Set secrets `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
   - Stripe → Developers → Webhooks → add endpoint `https://lqktkqwfgbmqnetvbsfm.supabase.co/functions/v1/stripe-webhook` for `checkout.session.completed`. The signing secret it shows is `STRIPE_WEBHOOK_SECRET`.
   - Test with Stripe's test mode first: a test Payment Link, card 4242 4242 4242 4242, and check the `entitlements` row appears.
4. **App Store version:** Apple requires its own in-app purchase for digital unlocks, so the native app hides the buy button. Before submitting, add RevenueCat (free under $2,500 a month) with a non-renewing "season pass" product and write the entitlement the same way.
