# Chatimpu — hyperlocal short news for India

A premium, editorial-grade short-news app: every story is a 60–80 word card you flip through
with a 3D page-flip, filtered down to your district, mandal and village, in 9 Indian languages.

> **Chatimpu — చాటింపు** is the drum-beat announcement that once carried news through Telugu
> towns and villages. Name, Telugu wordmark and domain live in `app/src/config.ts` (+ `name`/`slug` in `app/app.json`).

## Brand

**Colours — red · white · black.** Brand red `#D7141A`, near-black `#0A0A0A`, white `#FFFFFF`.
Text on red is always white (5.2:1); red used as small text on black switches to `#FF4D52` (6.1:1),
so every combination meets WCAG AA. Light, Night and AMOLED themes all use the same three colours.

**Telugu typography.** Chosen from the open-licensed (SIL OFL, free to embed in apps) Telugu faces
designed for news and screen reading:

| Role | Font | Why |
|---|---|---|
| Headlines, wordmark | **Ramabhadra** | Bold Telugu display face built for headlines and large sizes; one of the most used Telugu fonts on Google Fonts |
| Story text | **Mandali** | Designed specifically for Telugu news publications; open, smooth letterforms and many distinct conjuncts, comfortable for 60–80 word summaries |
| Buttons, labels, tabs | **Hind Guntur** (500/600) | Indian Type Foundry UI family with real weights, so small Telugu UI text stays crisp |

Each Telugu face gets its own size and line-height correction (`app/src/theme/fonts.ts`): Ramabhadra is
set ~10% smaller with tight leading; Mandali keeps full size with 1.36× leading so vowel signs and
conjuncts never clip. English uses Playfair Display + Inter. The CMS loads the same Telugu fonts.

<p>
<img src="docs/screenshots/feed-en.jpg" width="200" alt="Flip feed, light theme">
<img src="docs/screenshots/feed-en-flipping.jpg" width="200" alt="Mid page-flip (Telugu)">
<img src="docs/screenshots/feed-te.jpg" width="200" alt="Telugu feed, Night theme">
<img src="docs/screenshots/explore-poll.jpg" width="200" alt="Top Buzz and polls">
</p>
<p>
<img src="docs/screenshots/local-en.jpg" width="200" alt="Local, Telugu">
<img src="docs/screenshots/profile-amoled.jpg" width="200" alt="Profile, AMOLED theme">
<img src="docs/screenshots/story-te.jpg" width="200" alt="Telugu story: Ramabhadra + Mandali">
<img src="docs/screenshots/splash.jpg" width="200" alt="Splash">
</p>
<img src="docs/screenshots/cms-dash.jpg" width="820" alt="Newsroom CMS dashboard">
<img src="docs/screenshots/cms-editor.jpg" width="820" alt="Story editor with AI assist and phone preview">

```
chatimpu/
├── app/        Mobile app — Expo SDK 58, React Native 0.88, Expo Router, Reanimated 4, Gesture Handler 3
├── admin/      Newsroom CMS — Vite + React 19 + TypeScript
├── supabase/   Postgres schema, RLS, RPC API, seed, Edge Functions (AI assist, push), search sync
└── docs/       API reference
```

The app and CMS share one source of truth for types and sample data: `app/src/data/`
(24 stories × English + Telugu across Hyderabad, Warangal and Visakhapatnam, plus polls, alerts,
magazines, ads, videos and citizen reports). The SQL seed is generated from the same files.

## Quick start (demo mode — no backend needed)

Requirements: Node 20+.

```bash
# Mobile app
cd app && npm install
npx expo start            # press a (Android), i (iOS) or w (web)
```

Most of the app runs in **Expo Go**; for haptics, share-as-image, notifications and video in
production, make a development build: `npx expo run:android` / `npx expo run:ios`, or
`npx eas-cli build --profile development`.

Demo login: any 10-digit number, OTP **123456** (makes you a verified Citizen Reporter).

```bash
# Newsroom CMS
cd admin && npm install && npm run dev      # http://localhost:5173
```

In demo mode the CMS sidebar has a **"sign in as"** switch for Super Admin / Editor /
District Moderator (Warangal) / Reporter (Visakhapatnam), so you can see each role's scope.
AI buttons use a clearly-labelled offline fallback until the backend is connected.

## Connecting the backend (Supabase)

```bash
npm i -g supabase
cd chatimpu
supabase init                                 # once; keeps ./supabase as-is
supabase start                                # local stack (Docker) — or link a cloud project:
# supabase link --project-ref <ref>
supabase db reset                             # applies migrations/*.sql and seed.sql
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-assist send-push
```

Then set the keys:

| App (`app/.env`) | CMS (`admin/.env`) |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

Other one-time setup:
- **Phone OTP**: Auth → Providers → Phone (MSG91 / Twilio / Gupshup).
- **Scheduled publishing**: `select cron.schedule('publish-scheduled', '* * * * *', $$select publish_due()$$);`
- **Image CDN**: `alter database postgres set app.image_cdn = 'https://img.your-cdn';` — `image_url()`
  requests `?width=…&format=webp`, which works with Supabase image transforms, imgproxy or Cloudflare Images.
- **Search**: run `supabase/search/meili-sync.ts` on a schedule against Meilisearch (or swap for Algolia;
  the Postgres `search_stories` RPC is the fallback).
- **Push**: add FCM credentials to your EAS project; call `send-push` from the CMS publish action or
  a database webhook on `stories`.
- Regenerate the seed after editing sample data: `npx tsx supabase/seed/generate.ts > supabase/seed.sql`.

## What's in the app

| Area | Where |
|---|---|
| Design system — tokens, light / night / AMOLED themes, WCAG AA notes | `app/src/theme/` |
| Per-language fonts (Playfair + Inter; Telugu: Ramabhadra + Mandali + Hind Guntur; Noto Serif Devanagari headlines; Noto Sans for other scripts), lazily loaded | `app/src/theme/fonts.ts` |
| 9-language UI (en, te, hi fully; ta, kn, ml, mr, bn, gu core UI with English fallback) | `app/src/i18n/` |
| 3D flip feed (Flipboard-style split-page fold, flicker-free, haptic on flip, a11y next/prev actions) | `app/src/components/feed/FlipFeed.tsx` |
| Story card, reactions 👍 😮 😢 😡, Listen (TTS), bookmark, WhatsApp share | `components/feed/StoryCard.tsx` |
| Branded share-as-image template (1080×1350) | `components/feed/ShareCard.tsx`, `lib/share.ts` |
| Native full-screen ad every 8–10 flips; sponsored stories always labelled; Premium hides ads | `components/feed/types.ts`, `AdCard.tsx` |
| On-device personalisation (dwell time, skips, shares) + locality ranking | `lib/personalize.ts`, `store/library.ts` |
| Offline cache of the last 100 stories | `store/library.ts`, `hooks/useStories.ts` |
| Onboarding: splash → language → GPS/manual State→District→Mandal→Village → interests → phone OTP / guest | `app/src/app/onboarding/` |
| Feed chips For You / Local / Trending / Breaking, breaking ticker | `app/(tabs)/feed.tsx` |
| Explore: categories, magazines, Top Buzz, polls with district vs national results | `app/(tabs)/explore.tsx` |
| Videos: vertical autoplay reels with timed captions | `app/(tabs)/videos.tsx` |
| Local: map + list, alerts (power, water, traffic, weather, jobs, events), nearby with distance | `app/(tabs)/local.tsx` |
| Profile: bookmarks, history, language, location, interests, notifications, theme, Premium | `app/(tabs)/profile.tsx`, `app/settings/` |
| "Today in 60 seconds" morning/evening audio briefing | `app/digest.tsx` |
| Search with location / category / date / language filters | `app/search.tsx` |
| Citizen Reporter (verified users, photos/videos, moderation queue) | `app/report.tsx` |

## What's in the CMS

Dashboard (KPIs, trends, top stories, queue) · Stories (filters by district/category/status/language) ·
Story editor (9 language tabs, word counter, AI summarise / translate / headline suggestions, location
cascade, image, schedule, breaking, push toggle, sponsored, live phone preview) · Moderation queue
(AI pre-check, edit, approve → published story, reject) · Analytics (views/flips/shares/readers trend,
category and district breakdowns, retention, table view) · Ad manager (district targeting, frequency,
CTR, revenue) · Polls · Users & roles.

## Notes and known limits

- Sample images come from `picsum.photos` and sample videos from Google's public test bucket; replace
  with your CDN. Stories, people and figures in the sample data are illustrative, not real reporting.
- The Local map is a stylised SVG map (no API key, works on web). For a street map, swap in
  `react-native-maps` with a dark custom style; pins and selection logic stay the same.
- Tamil, Kannada, Malayalam, Marathi, Bengali and Gujarati UI strings should be reviewed by native
  editors before launch; untranslated keys fall back to English.
- Payments for Premium (Play Billing / StoreKit, e.g. via RevenueCat) are stubbed in `app/premium.tsx`.
- In demo mode the CMS keeps edits in memory; with Supabase configured, wire `lib/store.tsx`
  mutations to the endpoints in `docs/API.md`.

## Checks

```bash
cd app && npx tsc --noEmit && npx expo export --platform web
cd admin && npm run build
```
