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

## 5. First sign-in on a device that already has pins

Everything already on the device is uploaded into the account the first time you sign in. If a device was last used by a different account, the app asks whether to add its pins to the new account or start clean.

## How sync works

- Local IndexedDB stays the source of truth for the screen, so the app works with no signal.
- Every pin, line and photo has a stable UUID, a dirty flag and a tombstone. Edits push after a couple of seconds of quiet; pulls happen on sign-in, when the app comes to the foreground, when the connection returns, and every five minutes.
- Conflicts resolve last-write-wins by the device clock. Two people editing the same pin within seconds of each other is not a case this version handles beyond that.
- Photos upload once (full size and thumbnail) to a private bucket under the user's own folder. Other devices download thumbnails immediately and full images when opened.
- Settings sync as one document on the profile. "Use without an account" is a device choice and does not sync.

## Costs and limits

The free plan covers a few friends: 500 MB database, 1 GB photo storage, 50,000 monthly active users. Two things to know: a free project **pauses after seven days without traffic** and has to be restored from the dashboard, and the built-in mailer is rate-limited. The Pro plan ($25/month) removes the pause and raises the limits. Before charging anyone for the app, also budget for commercial weather data (Open-Meteo's paid plan) and a paid map-tile provider; the free sources Rutline uses are licensed for non-commercial use.

## Testing without a project

On a dev build (`npm run dev`), run `localStorage.setItem('rutline.cloud', 'mock')` in the browser console and reload. A fake backend stored in localStorage stands in for Supabase: any email with any 8-character password signs in, and the one-time code is `000000`. Remove the key to go back.
