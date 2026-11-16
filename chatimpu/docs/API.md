# Chatimpu API

The backend is Supabase (Postgres + Auth + Storage + Edge Functions). Clients use **PostgREST**
(tables/views, protected by row-level security), **RPC functions** for anything that needs
logic, and **Edge Functions** for AI and push. All JSON shapes match `app/src/data/types.ts`.

Base URL: `https://<project>.supabase.co`. Every request sends `apikey: <anon key>`;
signed-in requests also send `Authorization: Bearer <user JWT>`.

## Auth — phone OTP

| Step | Call |
|---|---|
| Send code | `POST /auth/v1/otp` `{ "phone": "+919876543210" }` (`supabase.auth.signInWithOtp`) |
| Verify | `POST /auth/v1/verify` `{ "phone": "+91…", "token": "123456", "type": "sms" }` (`supabase.auth.verifyOtp`) |

A `profiles` row is created by trigger on first sign-in (`role = 'reader'`). Configure an SMS
provider (MSG91 / Twilio / Gupshup) under Auth → Providers → Phone.

## Reader endpoints

| Purpose | Call | Auth |
|---|---|---|
| Hyperlocal feed | `POST /rest/v1/rpc/get_feed` `{ p_lang, p_district, p_mandal, p_limit = 100, p_before? }` → `Story[]` ranked by locality, breaking, engagement and recency | anon |
| Search (Postgres fallback) | `POST /rest/v1/rpc/search_stories` `{ q, p_district?, p_category?, p_since? ('24 hours'), p_lang? }` | anon |
| Search (production) | Meilisearch index `stories`, filters `districtId`, `category`, `lang`, `publishedAt` — synced by `supabase/search/meili-sync.ts` | search key |
| Videos | `GET /rest/v1/video_feed?limit=30` | anon |
| Polls + live results | `POST /rest/v1/rpc/get_polls_with_results` → `Poll[]` with `votes.national` and `votes[districtId]` | anon |
| Vote | `POST /rest/v1/rpc/cast_vote` `{ p_poll, p_option, p_district }` — one vote per user, ignored after close | user |
| Local alerts | `GET /rest/v1/local_alerts?district_id=eq.hyd&order=starts_at` | anon |
| Magazines | `GET /rest/v1/magazines?select=*,magazine_stories(story_id,sort)` | anon |
| Bookmarks | `GET/POST/DELETE /rest/v1/bookmarks` (`user_id` = you) | user |
| React | `POST /rest/v1/reactions` `{ story_id, kind: like|wow|sad|angry }` with `Prefer: resolution=merge-duplicates` | user |
| Comment | `POST /rest/v1/comments` `{ story_id, body }` | user |
| Engagement events | `POST /rest/v1/rpc/log_events` `{ p_events: [{ storyId, districtId, action: view|flip|skip|share|listen|bookmark, dwellMs }] }` — batched by the app every 15 s | anon/user |
| Push token | `POST /rest/v1/push_tokens` `{ token, platform, district_id, mandal_id, language, interests, prefs }` (upsert) | user |
| Citizen report | upload media to `storage/v1/object/media/citizen/<file>`, then `POST /rest/v1/citizen_reports` `{ headline, body, lang, category_id, district_id, mandal_id, media[] }` — RLS allows only `verified_reporter` users | verified user |

## Newsroom (CMS) endpoints

| Purpose | Call | Roles |
|---|---|---|
| Create / edit story | `POST/PATCH /rest/v1/stories` + `/rest/v1/story_translations` (one row per language; summary 30–100 words enforced by a CHECK) | super_admin, editor, district_moderator (own districts), reporter (own drafts) |
| Schedule | `status = 'scheduled', publish_at = …`; `select publish_due()` runs every minute via pg_cron | as above |
| Moderation queue | `GET /rest/v1/citizen_reports?status=eq.pending&order=submitted_at` | moderators of that district, editors, super admin |
| Approve | `POST /rest/v1/rpc/approve_report` `{ p_report, p_headline, p_summary, p_image_path, p_note? }` → new story id | same |
| Reject | `PATCH /rest/v1/citizen_reports?id=eq.<id>` `{ status: 'rejected', review_note }` | same |
| Local alerts | `POST /rest/v1/local_alerts` | moderators of that district |
| Ads | `/rest/v1/ads`, `/rest/v1/advertisers` | super_admin |
| Analytics | `GET /rest/v1/analytics_daily`, `analytics_category`, `analytics_retention` | staff |
| Roles | `PATCH /rest/v1/profiles?id=eq.<id>` `{ role, verified_reporter }`, `moderator_districts` | super_admin |

### Edge Function `ai-assist` (Claude)

`POST /functions/v1/ai-assist` — staff only. Uses Claude Opus 5.5 with JSON-schema structured
output and server-side refusal fallbacks. Secret: `ANTHROPIC_API_KEY`.

| task | body | returns |
|---|---|---|
| `summarize` | `{ article, lang }` | `{ headline, summary, wordCount }` (60–80 words) |
| `translate` | `{ card: { headline, summary }, from, to: ['te','hi',…] }` | `{ te: { headline, summary }, … }` |
| `headlines` | `{ card, lang }` | `{ options: string[5] }` |
| `moderate` | `{ report: { headline, body, lang } }` | `{ flags[], risk, note, suggested? }` |

Errors: `401` not signed in, `403` not staff, `422 { refusal: true }` if the model declined, `429` rate-limited, `502` upstream error.

### Edge Function `send-push`

`POST /functions/v1/send-push` `{ storyId, kind: breaking|local|digest|interests, districtIds? }` — editors/moderators.
Targets `push_tokens` by district, interests and per-user preferences; sends rich notifications
(image + deep link `chatimpu://story/<id>`) through Expo Push → FCM/APNs. Breaking goes to every district.

## Data model

```
states ─< districts ─< mandals ─< villages
categories ─< category_names(lang)
stories ─< story_translations(lang)   stories ─< story_tags
        ─< reactions / bookmarks / comments / read_events      (users = profiles ← auth.users)
polls ─< poll_questions(lang), poll_options ─< poll_option_labels(lang); votes(poll,user → option, district)
magazines ─< magazine_stories      local_alerts      videos
citizen_reports → stories (on approval)
advertisers ─< ads                 push_tokens       moderator_districts
```

Full DDL: `supabase/migrations/0001_schema.sql`; RLS: `0002_rls.sql`; functions/views: `0003_api.sql`.
