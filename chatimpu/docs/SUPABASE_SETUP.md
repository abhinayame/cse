# Connecting Chatimpu to Supabase — step by step

Takes about 30–45 minutes. You need a free account at https://supabase.com and a computer with
Node 20+ and this repository checked out. Steps marked **(dashboard)** are clicks in the Supabase
website; steps marked **(terminal)** are commands.

---

## 1. Create the project (dashboard)

1. Go to https://supabase.com/dashboard → **New project**.
2. Name: `chatimpu`. Set a strong **database password** and save it in a password manager.
3. Region: **Mumbai (ap-south-1)** — closest to your readers in AP / Telangana.
4. Click **Create new project** and wait ~2 minutes.

## 2. Copy your keys (dashboard)

**Project Settings → API** (or **Data API**). Note down:

| Name | Where it's used | Secret? |
|---|---|---|
| **Project URL** (`https://xxxx.supabase.co`) | app + CMS | no |
| **anon / publishable key** | app + CMS | no — safe inside the app |
| **service_role / secret key** | only server code | **YES — never put it in the app, CMS or git** |

Also note the **project ref** — the `xxxx` part of the URL.

## 3. Create the database (dashboard → SQL Editor)

Open **SQL Editor → New query**. Run these four files **in this order**: open each file from the
repo, paste the whole contents, click **Run**, wait for "Success", then do the next.

1. `chatimpu/supabase/migrations/0001_schema.sql` — tables (turns on PostGIS and pg_trgm)
2. `chatimpu/supabase/migrations/0002_rls.sql` — security rules + the `media` storage bucket
3. `chatimpu/supabase/migrations/0003_api.sql` — feed, polls, voting, moderation, analytics
4. `chatimpu/supabase/seed.sql` — the 24 sample stories, districts, polls, alerts, ads, videos

Check it worked: **Table Editor → stories** should show 24 rows. Then in SQL Editor run:

```sql
select jsonb_array_length(get_feed('te', 'hyd', 'hyd-amp'));   -- expect a number > 0
```

> Prefer the command line? Instead of step 3: `npm i -g supabase`, then from `chatimpu/`:
> `supabase init`, `supabase link --project-ref <ref>`, `supabase db push`, and run `seed.sql` in the SQL editor.

## 4. Phone OTP login (dashboard → Authentication)

1. **Authentication → Sign In / Providers → Phone** → turn **Enable phone provider** on.
2. **For testing first (free, no SMS sent):** in the same panel, add **Test phone numbers / OTPs**,
   e.g. `919876543210=123456`. Logging in with that number and code works without any SMS provider.
3. **For real users:** choose an SMS provider in the same panel (Twilio, Twilio Verify, MessageBird,
   Vonage or Textlocal) and paste its credentials. To use **MSG91** or another Indian gateway instead,
   use **Authentication → Hooks → Send SMS hook**.
4. **India rule:** SMS to Indian numbers must use a **DLT-registered** sender ID and template
   (TRAI). Register on a DLT portal (Jio / Vodafone Idea / Airtel) with a template like
   `{#var#} is your Chatimpu login code.` and give the IDs to your SMS provider.
5. **Authentication → Rate limits:** keep the SMS limit low (e.g. 30/hour) to avoid SMS-bombing bills.

## 5. Make yourself Super Admin (app + SQL Editor)

1. Sign in once in the app with your phone number (step 9 below), so your profile row is created.
2. SQL Editor:

```sql
-- phone is stored without the '+', e.g. 919876543210
update profiles set role = 'super_admin', verified_reporter = true where phone = '91XXXXXXXXXX';
```

Other roles the same way: `'editor'`, `'district_moderator'`, `'reporter'`. A moderator also needs districts:

```sql
insert into moderator_districts (user_id, district_id)
select id, 'wgl' from profiles where phone = '91XXXXXXXXXX';   -- hyd / wgl / vsp
```

Make a reader a **verified Citizen Reporter** (allowed to submit stories):

```sql
update profiles set verified_reporter = true where phone = '91XXXXXXXXXX';
```

## 6. Scheduled publishing (dashboard)

1. **Database → Extensions** → enable **pg_cron**.
2. SQL Editor:

```sql
select cron.schedule('publish-scheduled', '* * * * *', $$select publish_due()$$);
```

Stories saved with status `scheduled` now go live at their `publish_at` time.

## 7. AI assist and push notifications — Edge Functions (terminal)

```bash
npm i -g supabase
cd chatimpu
supabase login
supabase init                                  # once; answer "N" to the VS Code / Deno prompts
supabase link --project-ref <your-project-ref>
supabase secrets set ANTHROPIC_API_KEY=<your Anthropic API key>
supabase functions deploy ai-assist
supabase functions deploy send-push
```

- Get the Anthropic key at https://console.anthropic.com → **API Keys**. It stays on Supabase's
  servers; it is never in the app.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the functions
  automatically — don't set them.
- Optional: `supabase secrets set IMAGE_CDN=https://<ref>.supabase.co/storage/v1/render/image/public/media`
  so push notifications show the story image.

## 8. Images (SQL Editor, optional)

Stories store an image path; the database turns it into a resized WebP URL. To serve images from
your project's Storage (bucket `media`, created in step 3):

```sql
alter database postgres set app.image_cdn = 'https://<ref>.supabase.co/storage/v1/render/image/public/media';
```

Image transformations need the Supabase **Pro** plan. On the free plan, skip this step and store
full `https://` image URLs on stories (they are used as-is).

## 9. Point the app at Supabase and rebuild (terminal)

The app reads its keys **when it is built**, so the APK must be rebuilt after this step.

1. Create `chatimpu/app/.env` (it is git-ignored):

```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable key>
```

2. Rebuild:

```bash
cd chatimpu/app
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# APK: app/build/outputs/apk/release/app-release.apk
```

Or build in the cloud: `npx eas-cli build -p android --profile preview` (put the two variables in
the EAS project's **Environment variables**).

The demo OTP `123456` stops working once keys are set — use a test number from step 4.

## 10. Push notifications (Expo + Firebase)

1. `cd chatimpu/app && npx eas-cli init` — links an Expo project (adds its `projectId` to `app.json`).
2. In the Firebase console, create a project, add an Android app with package `in.chatimpu.app`,
   then **Project settings → Service accounts → Generate new private key**.
3. `npx eas-cli credentials` → Android → **Google Service Account Key for FCM V1** → upload that JSON.
4. Rebuild the app (step 9). Devices then save their push token in the `push_tokens` table, and
   `send-push` can target them by district and interest.

## 11. CMS (newsroom dashboard)

Create `chatimpu/admin/.env`:

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon / publishable key>
```

> **Current limit:** the CMS still works on in-memory demo data and has no staff sign-in screen yet,
> so with keys set it will not save to the database, and the AI buttons need a signed-in staff user.
> Until that is wired up, newsroom changes can be made in **Table Editor**
> (`stories`, `story_translations`, `citizen_reports`, `local_alerts`, `ads`, `polls`).

## 12. Before going live — checklist

- [ ] **Authentication → URL Configuration:** set the Site URL to your CMS address.
- [ ] Never ship or commit the **service_role** key. Only the anon key goes in apps.
- [ ] **Advisors → Security Advisor:** fix anything it reports.
- [ ] **Database → Backups:** confirm daily backups (Pro plan has point-in-time recovery).
- [ ] Turn off test phone numbers once real SMS works.
- [ ] Sign the Android app with your own upload key before the Play Store
      (`npx eas-cli credentials`, or a keystore in `android/app`).
