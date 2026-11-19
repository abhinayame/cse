# Chatimpu reporter ecosystem

**YOUR LOCALITY. YOUR VOICE. YOUR NEWS.**

Contributors report from their locality. Editors verify and publish their work. Finance pays them for approved work. All three run on the **same Supabase project, sign-in and API** as the reader app and the newsroom CMS. No second backend was added.

| Module | Where | Who |
|---|---|---|
| Reporter portal (mobile-first, Telugu/English) | CMS app at **`/reporter`** (`admin/src/reporter/`) | contributors (phone OTP) |
| Editorial desk, Reporters, Assignments, Recognition | CMS (`admin/src/pages/Editorial.tsx`, `Reporters.tsx`, `AssignmentsAdmin.tsx`, `Recognition.tsx`) | super admin, editors, district moderators |
| Finance desk | CMS → **Finance** (`admin/src/pages/Finance.tsx`) | anyone holding the **finance** permission (never implied by a role) |
| **Reporter hub in the mobile app** | `app/src/app/reporter/*` (Profile tab → Reporter hub) | contributors: dashboard, registration, submit with photos/videos, my news, assignments, wallet / withdraw / history, payout methods, ID + PAN, notifications. Same routes as the web portal, so push links open the matching screen. |
| Reader app "Citizen Reporter" | `app/src/app/report.tsx` | verified contributors, same workflow |
| Database, RLS, workflow, ledger | `supabase/migrations/0005_reporters.sql` | — |
| Payout server code (RazorpayX + mock) | `supabase/functions/_shared/payouts/`, `payouts`, `payout-methods`, `razorpayx-webhook`, `notify-dispatch` | server only |

---

## 1. Architecture discovered and reused

- **Reader app:** Expo / React Native. **CMS:** Vite + React. **Backend:** Supabase (Postgres with RLS, PostGIS and pg_trgm, Auth, Storage, Deno Edge Functions).
- **Reused:**
  - `profiles` and roles (`super_admin`, `editor`, `district_moderator`, `reporter`).
  - `moderator_districts` and `moderates()`.
  - `citizen_reports`, which is extended rather than replaced.
  - `stories` / `story_translations`: approved reports become normal stories.
  - `app_settings`, the `media` bucket, `push_tokens` and `send-push`.
  - The CMS layout, store, AI client (`ai-assist`) and design tokens.
  - The app's location data.
- **The legacy entry point `approve_report()` still works.** It now routes through the full editorial workflow, with "no payment" as the contribution type.

## 2. Contributor lifecycle

**Account statuses:** `registered` → `verification_pending` (ID submitted) → `verified` (ID approved) → `active`. An account can also be `suspended` or `rejected`, always with a reason that the reporter sees.

- **Registration** collects:
  - name, mobile (from OTP), optional email and photo
  - district, mandal, locality and preferred language
  - interests and a short intro
  - acceptance of the contributor agreement (versioned in `app_settings.contributor_agreement_version`)
- **Identity documents:**
  - Stored in the private `reporter-private` bucket under `<uid>/id/…`.
  - Only the **last 2–4 characters** are stored as data.
  - For Aadhaar we ask for a **masked** copy, and the UI tells reviewers to reject unmasked ones.
- **Categories:** Community Contributor, Verified Local Reporter, Area Correspondent, Senior Correspondent, Editorial Contributor.
  - The portal and CMS state that these are **not press accreditation**.
- **Who can submit:** only `verified` or `active` reporters. Drafts are allowed before that.
- **Who can withdraw:** only `active` reporters with an approved ID document and a verified payout method.

## 3. Submission → editorial workflow

```
DRAFT → SUBMITTED → AI_PROCESSING (automatic checks) → UNDER_REVIEW → APPROVED → PUBLISHED
                                                     ↘ CORRECTION_REQUIRED (reporter edits, resubmits)
                                                     ↘ ON_HOLD ↔ UNDER_REVIEW
                                                     ↘ REJECTED (reason required)
```

**Submission types:** text, photo story, video, voice report, detailed report, civic issue, education, government, event, community, and business / jobs.

**Contents of a submission:** headline, description, optional summary, category, language, district / mandal / locality, exact location (with optional GPS), date and time, photos, videos and documents (up to 100 MB each), an optional voice recording, confidential source notes, and **rights and consent** (required).

**On submit, a database trigger:**
- assigns a unique code `CHT-YYMM-000001`
- checks rights and consent, minimum lengths and the daily limit (`submissions_per_day_limit`)
- flags **sensitive** topics (crime, communal, political allegation, health, personal accusation)
- finds **duplicates** among submissions and published stories with pg_trgm
- logs each step to `editorial_reviews`

**Media handling:**
- Originals go to the **private `submissions` bucket** under `<uid>/<submission>/…`.
- Editors see originals through signed URLs only.
- On publish, only the photo the editor chooses is copied to the public `media` bucket.

**Editor tools** (all audited in `editorial_reviews`):
- preview photos, video and audio
- edit the headline, body, summary and category
- set priority
- duplicate hints
- a human-verification checklist with notes
- AI risk check, summary draft, headline options and translation, all labelled "suggestions only, never proof of truth"
- request correction (reason required), hold, reject (reason required), approve, or approve & publish

**Safeguards:**
- **Sensitive stories cannot be approved until an editor records human verification.**
- Clearing a sensitivity flag requires a written justification.
- Published and rejected items cannot be edited from the desk.
- Reporters see editorial decisions on their own work. They **never** see editors' verification notes, the automatic flags or edit diffs.
- Source notes are visible only to editors of that district.

## 4. Earnings, ledger and threshold

All amounts are **integer paise**. The **ledger is the source of truth**:

- `wallet_ledger_entries`: an append-only list of deltas to the available, reserved and paid buckets, each with a unique `idempotency_key`.
- `wallet_accounts`: running balances, row-locked (`FOR UPDATE`) during every posting.
- `ledger_check()`: proves that the balances equal the ledger.

**Rate card** (`contribution_rates`, editable in Finance → Rate card & rules; nothing is hard-coded in the frontend):

| Code | Default |
|---|---|
| text_news | ₹5 |
| original_photo | ₹10 |
| original_video | ₹25 |
| detailed_report | ₹50–₹100 |
| special_assignment | set per assignment |
| bonus | set per award (finance only) |

- Earnings are credited **only when an editor approves**.
- An earning is credited **once per submission**: a unique index plus a check.
- An assignment's special payment is credited **once per assignment**.
- Each earning records: code (`ERN-…`), reporter, submission or assignment, contribution type, amount, approval time, approving editor and status.
- Reversals post a compensating ledger entry. They never delete anything.

**Withdrawal threshold:**
- `app_settings.withdrawal_threshold_paise`, default **30000 (₹300)**.
- Editable by finance or a super admin between ₹1 and ₹1,00,000, and every change is audited.
- Earnings still under review show as **pending** and never count towards the available balance.
- The reporter dashboard shows: total earned, pending, available, threshold, eligibility, reserved, withdrawn and full history.

## 5. Payout methods and withdrawals

**Payout methods** (UPI ID, or bank account number + IFSC + bank name, plus the holder's name). A mobile number alone is rejected.

- The `payout-methods` function validates the details and **encrypts them with AES-256-GCM** (`PAYOUT_ENCRYPTION_KEY`).
- The encrypted copy is stored in `payout_method_secrets`, which has RLS on and **no policies**, so only the service role can read it.
- Profiles, lists, logs and audit entries only ever show masked values (`la••••••@okaxis`, `••••4321`).
- A keyed fingerprint blocks duplicate methods.
- Finance verifies a method (for example by name lookup or penny drop) before it can be used.
- Finance users cannot verify their own payment methods.

**Withdrawal statuses:** `requested → under_review → approved → processing → paid`, plus `failed`, `rejected`, `reversed` and `cancelled`.

- **Request:** checks status, ID, verified method, threshold, balance and the open-request limit, then **reserves** the amount in the same transaction (available → reserved). Concurrent requests cannot double-spend: in testing, exactly one of five simultaneous requests succeeded.
- **Reject or cancel:** the reservation is released back to available.
- **Paid:** set only when the **provider confirms** (webhook or status sync), or when finance records a manual payout with a bank **UTR**. A payout is **never** marked successful merely because an API request was accepted.
- **Failed or reversed:** the withdrawal is flagged `needs_reconciliation` and the money stays reserved. It is restored only after finance reconciles. For provider payouts the provider is asked for the final state first. Manual payouts need bank evidence.
- **Ignored:** stale or out-of-order webhook states, duplicate webhook events and amount mismatches.

**Verified end to end** (`supabase/tests/local/e2e.cjs`):

| Step | Available | Reserved | Paid |
|---|---|---|---|
| ₹295 credited, then a ₹10 photo approved | ₹305 | — | — |
| Request ₹300 | ₹5 | ₹300 | — |
| Provider reports failure | ₹5 | ₹300 (needs reconciliation) | — |
| Finance reconciles | ₹305 | — | — |
| Request ₹300 again, provider confirms | ₹5 | — | ₹300 (UTR shown to the reporter) |

`ledger_check()` returns no rows (balances match the ledger), and no duplicate earnings exist.

## 6. RazorpayX Payouts (not Payment Gateway) — status

The code is complete and tested against the documented RazorpayX Payouts API and a mock provider. **No live or test RazorpayX credentials were available, so no real API call was made and no real money has moved.**

- **Server-side only:**
  - Contacts → fund accounts (`vpa` / `bank_account`) → payouts (`UPI` / `IMPS`).
  - Every payout carries an `X-Payout-Idempotency` key.
  - Status is fetched with `GET /payouts/:id`.
  - Webhook signatures (`X-Razorpay-Signature`, HMAC-SHA256 over the raw body) are verified, events are de-duplicated by `x-razorpay-event-id`, and the entity status is treated as authoritative.
- **Live mode needs all three:**
  - `rzp_live_…` keys
  - `APP_ENV=production`
  - the CMS kill-switch **Finance → Rate card & rules → Live payouts** turned on (off by default)
- **Test and live keys are separate.** The mock provider refuses to run when `APP_ENV=production`.
- **Without credentials** (today):
  - The `mock` provider runs the full workflow, with "Simulate processed / failed / reversed" buttons that go through the real signed-webhook code.
  - Finance can also pay through the bank portal and record the **UTR**: export the audited bank payout CSV, then use **Paid manually (UTR)**.

### Environment variables (Supabase → Edge Functions → Secrets)

| Name | Needed for | Notes |
|---|---|---|
| `PAYOUT_ENCRYPTION_KEY` | payout-methods, payouts | base64 of 32 random bytes: `openssl rand -base64 32`. **Back it up**: losing it makes stored bank details unreadable. |
| `PAYOUT_PROVIDER` | payouts | `mock` (default) or `razorpayx` |
| `RAZORPAYX_KEY_ID`, `RAZORPAYX_KEY_SECRET` | payouts | from RazorpayX → Settings → API Keys (test and live are different) |
| `RAZORPAYX_ACCOUNT_NUMBER` | payouts | your RazorpayX business account number (different in test and live) |
| `RAZORPAYX_WEBHOOK_SECRET` | razorpayx-webhook | the secret you type when creating the webhook |
| `APP_ENV` | all | `production` only on the live project |
| `CRON_SECRET` | notify-dispatch | random string; send it as the `x-cron-secret` header |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | all | provided automatically by Supabase |

**Never put any of these in the app or CMS.** The frontends only use `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (and optionally `EXPO_PUBLIC_REPORTER_PORTAL_URL` in the reader app).

### Deploy

```bash
cd chatimpu
supabase secrets set PAYOUT_ENCRYPTION_KEY="$(openssl rand -base64 32)" PAYOUT_PROVIDER=mock CRON_SECRET="$(openssl rand -hex 24)"
supabase functions deploy payout-methods
supabase functions deploy payouts
supabase functions deploy razorpayx-webhook --no-verify-jwt   # Razorpay can't send a Supabase JWT; the HMAC signature authenticates it
supabase functions deploy notify-dispatch --no-verify-jwt     # protected by CRON_SECRET
```

### Going live with RazorpayX

1. Complete RazorpayX KYC and activate **Payouts** (current account or RazorpayX Lite).
2. **Test mode first:**
   - Set the `rzp_test_…` keys, the test account number and `PAYOUT_PROVIDER=razorpayx`.
   - Create a webhook pointing to `https://<ref>.supabase.co/functions/v1/razorpayx-webhook` with the events `payout.processed`, `payout.reversed`, `payout.failed`, `payout.rejected`, `payout.initiated`, `payout.queued`, `payout.pending` and `payout.updated`.
   - Rehearse success, failure and reversal.
3. **IP allowlisting:**
   - RazorpayX requires your server's outbound IPs to be allowlisted for live payouts.
   - Supabase Edge Functions do not publish fixed outbound IPs, so confirm with Supabase and RazorpayX first.
   - If needed, route the RazorpayX calls through a small relay with a static IP. The provider client takes a custom `fetch`, so this is a configuration change, not a rewrite.
4. Switch to the live keys and the live account number, set `APP_ENV=production`, and turn on **Live payouts** in the CMS.
5. Keep finance approval manual. Initiation is always a finance user's explicit click.

## 7. Roles and permissions

| | Super admin | Editor | District moderator | Finance (permission) | Reporter admin (permission) | Contributor |
|---|---|---|---|---|---|---|
| Editorial desk | all districts | all districts | own districts | — | — | own submissions |
| Verify / activate / suspend reporters | ✓ | ✓ | own districts | — | ✓ | — |
| Assignments | ✓ | ✓ | own districts | — | — | accept / submit |
| Badges | ✓ | ✓ | — | cash bonus only with finance | — | view |
| Withdrawals, payouts, methods, rate card, threshold | ✓ | **✗** | **✗** | ✓ | — | own requests |
| Audit log | ✓ | — | — | finance entities | — | — |

- Super admins grant permissions under **Users & roles**.
- A finance-only account can keep the role "Reader" and sees only the Finance desk.
- The legacy `reporter` *staff* role gets **no** editorial access to contributors' submissions, media or PII.

## 8. Main API surface (PostgREST RPC with the user's JWT; RLS everywhere)

- **Contributors:**
  - `register_reporter`, `submit_verification`, `reporter_dashboard`
  - insert / update `citizen_reports` (drafts, `status:'submitted'`) and `submission_media`
  - `accept_assignment`, `request_withdrawal`, `cancel_withdrawal`, `deactivate_payout_method`
  - `POST /functions/v1/payout-methods`
- **Editors:** `editorial_set_status`, `editorial_update`, `editorial_approve`, `review_reporter`, `reporter_network`, `reporter_scores`, `award_badge`, `reporter_assignments` (table).
- **Finance:**
  - `finance_summary`, `finance_review_withdrawal`, `verify_payout_method`, `record_manual_payout`, `record_manual_failure`, `reconcile_withdrawal`, `update_rate`, `set_setting`, `ledger_check`
  - `POST /functions/v1/payouts` with `{action: status | initiate | sync | reconcile | export | simulate}`
- **Webhook:** `POST /functions/v1/razorpayx-webhook`.
- **Internal, service role only:** `ledger_post`, `credit_earning`, `reverse_earning`, `apply_payout_status`, `mark_withdrawal_processing`, `notify` and others. These are revoked from `anon` and `authenticated`.

## 9. Notifications

The `notifications` table holds in-app notifications in Telugu and English, shown on the portal's bell and its Notifications screen.

- **Events covered:** registration, verification, submission received, under review, correction, rejection, approval, publication, earnings credited, withdrawal eligibility, withdrawal requested / approved / rejected, payment completed, payment failed and restored, payment-method verification, new assignment (assigned, or open in your district) and badges.
- **Push delivery:** `notify-dispatch` (every minute, set up by `setup_scheduled_jobs()` in `0006_jobs.sql`) claims undelivered notifications atomically, so overlapping runs never double-send. It pushes them through Expo in the device's language, with a deep link (`chatimpu://reporter/…`) that opens the matching screen in the app, and removes device tokens Expo reports as unregistered.
- **Device tokens:** `register_push_token()` links a device to whoever is signed in on it, so account notifications follow a phone across sign-ins.
- **Data retention:** the daily `maintenance` job (see SUPABASE_SETUP §6). It deletes decided ID-document images, stale drafts (after warning the reporter), old notifications and raw webhook bodies. Financial, tax and audit records are never deleted.

## 10. Recognition

**Levels:** New Contributor → Active Contributor → Verified Local Reporter → Trusted Correspondent → Senior Correspondent.

**Monthly score** (`reporter_scores`):
- weighted by accuracy, which drops with rejections and corrections
- rewards original photos and videos, and activity across separate weeks
- counts at most **5 approvals per reporter per day**, so volume alone does not win

**Badges:** Best Reporter of the Month, Accuracy Champion, Best Original Video, Community Voice, Consistent Contributor, Civic Reporting Champion.
- Editors award them with a reason.
- An optional cash bonus needs the finance permission and goes through the ledger once.

## 11. Testing

```bash
# Backend integration tests (RLS, workflow, ledger, withdrawals, payouts incl. webhook & concurrency)
cd chatimpu/supabase/tests && npm install
SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm test     # 25 tests
npm run typecheck

# End-to-end (Playwright) against a local stack: GoTrue + PostgREST + Postgres with the migrations applied,
# test OTP 919000000001=123456, local/dev_storage.sql loaded, then:
SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npx tsx --tsconfig ./tsconfig.json local/gateway.mts <admin dist built with VITE_SUPABASE_URL=http://127.0.0.1:8090>
SUPABASE_SERVICE_ROLE_KEY=… PGURL=postgres://postgres@127.0.0.1:54329/sb node local/e2e.cjs   # 20 steps, screenshots to $E2E_SHOTS
```

The local gateway is a **test tool only**:
- storage permissions are decided by the real `storage.objects` RLS policies
- `/functions/v1/*` runs the real Edge Function code under a tiny `Deno` shim

## 12. Compliance — needs professional review before launch

These are flagged, not settled. Please have an Indian lawyer or CA review them.

- **Contributor agreement, media-rights licence, corrections policy, privacy notice and FAQ** (`admin/src/reporter/pages/Help.tsx`) are plain-language drafts.
- **Digital Personal Data Protection Act, 2023:** consent notices, purpose limitation, retention periods (payment records vs. ID documents), data-principal rights, breach handling, and whether a Data Protection Officer is needed. ID documents and payout data are private and encrypted or masked. Retention jobs now exist (`0006_jobs.sql`, SUPABASE_SETUP §6) with placeholder periods (ID images 30 days after the decision, stale drafts 90 days, notifications 180 days); **a lawyer should confirm the periods**.
- **Aadhaar:** collecting Aadhaar copies is restricted. We request masked Aadhaar or other IDs and store only the last characters. Confirm this is acceptable for your use, or drop Aadhaar as an option.
- **Tax:** TDS is implemented (§14) but **switched off**, with placeholder values (section 194J, 10% with PAN, 20% without, ₹50,000 a year). A CA must confirm:
  - the section (194J or 194C, depending on how the engagement is characterised), the rates and the threshold;
  - the catch-up treatment once the threshold is crossed;
  - quarterly deposit and filing (challan, Form 26Q), and Form 16A certificates, which come from TRACES and are not generated here;
  - GST implications for the platform.
- **IT Rules 2021 / digital news publisher obligations:** grievance officer, code of ethics and the three-tier grievance mechanism. Contributor titles are deliberately not press accreditation.
- **Payments:** RazorpayX terms, KYC for the business account, payout limits, and record-keeping for reconciliation.
- **Content:**
  - defamation exposure from contributor content (sensitive stories require human verification and cannot be auto-published)
  - POCSO and victim-identification rules
  - copyright in user-submitted media

## 13. Remaining work that needs credentials or decisions

- RazorpayX account, keys, webhook secret and IP allowlisting (see §6), followed by a test-mode rehearsal against the real API.
- `PAYOUT_ENCRYPTION_KEY`, generated and backed up in a secrets manager.
- SMS provider with **DLT-registered** templates for OTP (see SUPABASE_SETUP §4).
- A support mailbox: the portal links to `reporters@chatimpu.com`, so change it in `Help.tsx`.
- A cron schedule for `notify-dispatch`, and `EXPO_PUBLIC_REPORTER_PORTAL_URL` for the reader app.
- Legal and tax review (§12). Confirm the TDS values with a CA and switch TDS on (Finance → Tax & reports) before the first payouts.
- Backups: Supabase daily backups or PITR on a paid plan. Also export `wallet_ledger_entries`, `withdrawal_requests` and `payment_transactions` periodically for accounting.

## 14. Tax: TDS, PAN and reports (`0007_tax.sql`)

**Off by default.** Finance switches it on in **CMS → Finance → Tax & reports**, where the section, rates and yearly threshold are also set.

**PAN:**
- Reporters add their PAN in the portal under **Profile → PAN (for tax)**.
- It is validated and encrypted server-side, stored masked (`••••••234F`), and one PAN can belong to one account only.
- Finance verifies it; a finance user can't verify their own.
- The full PAN is decrypted only for the audited **TDS worksheet (26Q)** export.

**When TDS is deducted:**
- When finance approves a withdrawal, per Indian financial year (April–March, IST).
- Below the yearly threshold, nothing is deducted.
- When a payout takes the reporter over the threshold, TDS applies to the whole year's amount not yet taxed, so earlier small payouts are caught up.
- The rate is the PAN rate with a verified PAN, otherwise the no-PAN rate.

**Money flow:**
- The bank or RazorpayX receives the **net** amount.
- The wallet ledger still settles the **gross**: the TDS part is paid to the government on the reporter's behalf.
- The reporter sees "TDS −₹70 · You received ₹330". The payment notification and the bank CSV show net, gross and TDS.

**Corrections:** a rejected, failed or reversed payout voids its TDS record. A retry is taxed afresh, without double counting.

**Reports:**
- Per-reporter FY report (masked PAN, gross, TDS, to bank, challan).
- Monthly payouts (gross / TDS / net).
- Challan recording per quarter.
- The 26Q worksheet.

**Tested** in `supabase/tests/tax.test.ts` and E2E step 20.

## 15. Newsroom content (`0008_content.sql`)

### Duplicate reports: the earlier report wins

When two **different reporters** send the same incident from the same district within 48 hours, the later report is **rejected automatically**.

- The rejection names the earlier report's code, so the reporter can see what it duplicated.
- The rejected report never reaches editors and never earns money.
- **How matching works:** headline wording and shared keywords are compared, in Telugu and English. Telugu case endings count as the same word (అమీర్‌పేటలో ≈ అమీర్‌పేట).
- **Typical scores:** the same incident written by two people scores about 45–55%; different incidents in the same area score about 15–25%. The default threshold is 40%.
- **What is not auto-rejected:**
  - the same reporter sending twice (flagged for the editor only);
  - reports from different districts;
  - reports outside the time window.
- **Settings:** editors can switch the rule off and tune the match level and window under Editorial desk → Duplicate rules.
- **Mistakes:** an editor can reinstate any auto-rejected report, with a reason.

### News Reels

- The Videos tab is now **News Reels**: vertical presenter videos with a two-line headline strip (a short white line and a bold red line), "EP 3 / 10 · series" labels, and share and like counts.
- The CMS → **News Reels** page uploads videos (the poster is taken from the video), sets both headline lines in Telugu and English, and saves as draft or published.

### Daily WhatsApp status

- Shareable 9:16 cards: good morning / night, proverbs, quotes, devotional, motivation, festival art and memes.
- In the app: Explore → *Today's WhatsApp Status*, and a full-screen viewer that shares the card to WhatsApp **as an image** with the Chatimpu logo.
- The CMS → **WhatsApp Status** page plans cards per day, with a 7-day view and a "+1 day" copy button.
- The starter cards are original text plus traditional (public-domain) Telugu proverbs. Post only your own text, licensed images, or public-domain material.

### Automated intake

**How a run works:**
1. It runs at **05:00 and 17:00 IST**, ready for the 06:00 and 18:00 editions. An editor can also click "Run now".
2. Every *approved source* in CMS → **Auto intake** is read (RSS or Atom).
3. Each fresh item becomes a short card on the editorial desk that credits and links its source.
4. The cards go through the same sensitivity checks and earlier-wins duplicate rule as reporters' news, including across feeds. An item is never processed twice.

**Auto-publish:**
- Only sources marked **official** can auto-publish, to the next edition.
- Crime, political, health, duplicate, or too short/long items always wait for an editor.

**Summaries:** with `ANTHROPIC_API_KEY` set, cards get AI summaries (labelled machine-written); otherwise the item's own opening sentences are used.

**Getting to about 100 local stories a day:**
- The dashboard tracks the daily target per category, so you can see which categories have nothing yet.
- Reaching ~100 depends on how many sources you approve. Good starting points are district collectorates, police and municipal press notes, and licensed agencies.

**Copyright:** every source needs a licence note. Summarising other outlets' articles without permission may infringe copyright, so add only sources you may republish.

**Not yet done:** we haven't added any real feed URLs, because they need checking first. Add yours in the CMS.
