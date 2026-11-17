-- ════════════════════════════════════════════════════════════════════════════
-- 0005 · Reporter ecosystem: onboarding, editorial workflow, earnings ledger,
--        wallet + withdrawals, payouts, assignments, recognition, notifications.
--
-- Builds on existing entities instead of duplicating them:
--   profiles            → the user (role + verified_reporter flag kept in sync)
--   citizen_reports     → news submissions (extended with workflow columns)
--   app_settings        → payout threshold and finance settings
--   push_tokens         → push delivery for the new in-app notifications
--
-- Money is stored as integer paise (bigint). The ledger (wallet_ledger_entries) is
-- the financial source of truth; wallet_accounts is a locked running balance that
-- every ledger posting updates in the same transaction.
--
-- Safe to re-run in the Supabase SQL editor (idempotent DDL, policies dropped
-- before being recreated).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Profiles for recycled mobile numbers
-- profiles.phone is unique and copied from auth.users. If a number moved to a new account (numbers are
-- recycled by carriers), the stale copy made the 0003 trigger skip the new profile silently and every
-- reporter action then failed. Free the number from the stale profile and keep the copy in sync.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone is not null then
    update profiles p set phone = null where p.phone = new.phone and p.id <> new.id
      and not exists (select 1 from auth.users u where u.id = p.id and u.phone = new.phone);
  end if;
  insert into profiles (id, phone) values (new.id, new.phone) on conflict (id) do nothing;
  return new;
end $$;
create or replace function sync_profile_phone() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone is distinct from old.phone then
    if new.phone is not null then update profiles set phone = null where phone = new.phone and id <> new.id; end if;
    update profiles set phone = new.phone where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_phone_changed on auth.users;
create trigger on_auth_user_phone_changed after update of phone on auth.users for each row execute function sync_profile_phone();

-- ── Permissions (finance is a permission, not a role: editors never get it implicitly)
create table if not exists staff_permissions (
  user_id uuid not null references profiles on delete cascade,
  permission text not null check (permission in ('finance', 'reporter_admin')),
  granted_by uuid references profiles,
  granted_at timestamptz not null default now(),
  primary key (user_id, permission)
);

create or replace function has_permission(p text) returns boolean language sql stable security definer set search_path = public as $$
  select my_role() = 'super_admin'
      or exists (select 1 from staff_permissions where user_id = auth.uid() and permission = p)
$$;

create or replace function can_use_cms() returns boolean language sql stable as $$
  select is_staff() or has_permission('finance')
$$;

-- True only for the service role (Edge Functions) or a direct database console session.
-- NOTE: inside SECURITY DEFINER functions current_user is the owner, so it must not be used for this.
create or replace function is_service_caller() returns boolean language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
      or coalesce(current_setting('role', true), '') = 'service_role'
      or (session_user in ('postgres', 'supabase_admin') and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = '')
$$;

-- ── Audit log (append-only; written only by security-definer functions)
create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_entity_idx on audit_logs (entity, entity_id, created_at desc);

create or replace function audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, action, entity, entity_id, details) values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'))
$$;

-- ── In-app notifications (push delivery reuses push_tokens via the notify-dispatch function)
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  kind text not null,
  title_en text not null, title_te text,
  body_en text, body_te text,
  link text,
  data jsonb not null default '{}',
  read_at timestamptz,
  push_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
create index if not exists notifications_unsent_idx on notifications (created_at) where push_sent_at is null;

create or replace function notify(p_user uuid, p_kind text, p_title_en text, p_title_te text, p_body_en text default null, p_body_te text default null, p_link text default null, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, title_en, title_te, body_en, body_te, link, data)
  select p_user, p_kind, p_title_en, p_title_te, p_body_en, p_body_te, p_link, coalesce(p_data, '{}') where p_user is not null
$$;

create or replace function notify_finance(p_kind text, p_title text, p_body text, p_link text) returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, title_en, body_en, link)
  select distinct u, p_kind, p_title, p_body, p_link from (
    select user_id u from staff_permissions where permission = 'finance'
    union select id from profiles where role = 'super_admin') x
$$;

-- ── Settings (threshold etc. live in app_settings so they are configurable, never hardcoded)
insert into app_settings (key, value) values
  ('withdrawal_threshold_paise', '30000'),
  ('max_open_withdrawals', '2'),
  ('payouts_live_enabled', 'false'),
  ('submissions_per_day_limit', '30'),
  ('contributor_agreement_version', '"2026-11-v1"')
on conflict (key) do nothing;

create or replace function setting_int(p_key text, p_default bigint) returns bigint language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::bigint from app_settings where key = p_key), p_default)
$$;

-- Finance staff may change finance keys; super admins any key.
create or replace function set_setting(p_key text, p_value jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (my_role() = 'super_admin'
          or (has_permission('finance') and p_key in ('withdrawal_threshold_paise', 'max_open_withdrawals', 'payouts_live_enabled'))) then
    raise exception 'You do not have permission to change %', p_key using errcode = '42501';
  end if;
  if p_key = 'withdrawal_threshold_paise' and ((p_value #>> '{}')::bigint < 100 or (p_value #>> '{}')::bigint > 10000000) then
    raise exception 'Threshold must be between ₹1 and ₹1,00,000';
  end if;
  insert into app_settings (key, value, updated_at) values (p_key, p_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  perform audit('setting_changed', 'app_settings', p_key, jsonb_build_object('value', p_value));
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. REPORTER ONBOARDING
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists reporter_profiles (
  user_id uuid primary key references profiles on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 80),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  photo_path text,
  district_id text not null references districts,
  mandal_id text references mandals,
  locality text,
  preferred_language text not null default 'te' references languages,
  interests text[] not null default '{}',
  intro text check (intro is null or length(intro) <= 600),
  category text not null default 'community_contributor' check (category in
    ('community_contributor', 'verified_local_reporter', 'area_correspondent', 'senior_correspondent', 'editorial_contributor')),
  status text not null default 'registered' check (status in
    ('registered', 'verification_pending', 'verified', 'active', 'suspended', 'rejected')),
  status_reason text,
  agreement_version text,
  agreement_accepted_at timestamptz,
  reviewed_by uuid references profiles,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reporter_profiles_status_idx on reporter_profiles (status, district_id);

create table if not exists reporter_areas (
  user_id uuid not null references reporter_profiles on delete cascade,
  district_id text not null references districts,
  mandal_id text references mandals,
  primary key (user_id, district_id)
);

-- Identity verification. Store document type + last 4 characters only; the image lives in
-- the private reporter-private bucket. Never store a full Aadhaar number.
create table if not exists reporter_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references reporter_profiles on delete cascade,
  document_type text not null check (document_type in ('aadhaar_masked', 'voter_id', 'pan', 'driving_licence', 'press_id', 'college_id', 'other')),
  document_last4 text check (document_last4 ~ '^[A-Za-z0-9]{2,4}$'),
  document_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references profiles,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reporter_verifications_user_idx on reporter_verifications (user_id, created_at desc);

create or replace function reporter_status() returns text language sql stable security definer set search_path = public as $$
  select status from reporter_profiles where user_id = auth.uid()
$$;

create or replace function reporter_can_submit(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from reporter_profiles where user_id = p_user and status in ('verified', 'active'))
      or exists (select 1 from profiles where id = p_user and verified_reporter and not exists (select 1 from reporter_profiles where user_id = p_user))
$$;

-- Register or update own reporter profile. New sign-ups start as 'registered'.
create or replace function register_reporter(
  p_full_name text, p_email text, p_district text, p_mandal text, p_locality text, p_language text,
  p_interests text[], p_intro text, p_photo_path text, p_accept_agreement boolean)
returns reporter_profiles language plpgsql security definer set search_path = public as $$
declare r reporter_profiles; v text := (select value #>> '{}' from app_settings where key = 'contributor_agreement_version');
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if not coalesce(p_accept_agreement, false) then raise exception 'Please accept the contributor agreement'; end if;
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;
  insert into reporter_profiles (user_id, full_name, email, district_id, mandal_id, locality, preferred_language, interests, intro, photo_path, agreement_version, agreement_accepted_at)
  values (auth.uid(), trim(p_full_name), nullif(trim(p_email), ''), p_district, nullif(p_mandal, ''), nullif(trim(p_locality), ''), coalesce(p_language, 'te'),
          coalesce(p_interests, '{}'), nullif(trim(p_intro), ''), nullif(p_photo_path, ''), v, now())
  on conflict (user_id) do update set
    full_name = excluded.full_name, email = excluded.email, district_id = excluded.district_id, mandal_id = excluded.mandal_id,
    locality = excluded.locality, preferred_language = excluded.preferred_language, interests = excluded.interests, intro = excluded.intro,
    photo_path = coalesce(excluded.photo_path, reporter_profiles.photo_path),
    agreement_version = excluded.agreement_version, agreement_accepted_at = excluded.agreement_accepted_at, updated_at = now()
  returning * into r;
  update profiles set display_name = coalesce(nullif(display_name, ''), r.full_name), district_id = r.district_id, mandal_id = r.mandal_id where id = auth.uid();
  insert into reporter_areas (user_id, district_id, mandal_id) values (auth.uid(), r.district_id, r.mandal_id) on conflict (user_id, district_id) do update set mandal_id = excluded.mandal_id;
  if r.created_at > now() - interval '5 seconds' then
    perform notify(auth.uid(), 'registration', 'Welcome to Chatimpu reporters', 'చాటింపు రిపోర్టర్‌గా స్వాగతం',
      'Your registration is received. Add an ID document to get verified.', 'మీ నమోదు అందింది. ధృవీకరణ కోసం గుర్తింపు పత్రం జోడించండి.', '/reporter/profile');
  end if;
  return r;
end $$;

create or replace function submit_verification(p_document_type text, p_last4 text, p_document_path text) returns uuid
language plpgsql security definer set search_path = public as $$
declare vid uuid; st text;
begin
  select status into st from reporter_profiles where user_id = auth.uid() for update;
  if st is null then raise exception 'Register as a reporter first'; end if;
  if st in ('suspended', 'rejected') then raise exception 'Your account is %; contact support', st; end if;
  if p_document_path is not null and split_part(p_document_path, '/', 1) <> auth.uid()::text then raise exception 'Invalid document path'; end if;
  insert into reporter_verifications (user_id, document_type, document_last4, document_path) values (auth.uid(), p_document_type, nullif(p_last4, ''), p_document_path) returning id into vid;
  if st = 'registered' then update reporter_profiles set status = 'verification_pending', updated_at = now() where user_id = auth.uid(); end if;
  perform notify(auth.uid(), 'verification', 'Verification submitted', 'ధృవీకరణ అందింది', 'Our team will review your document.', 'మా బృందం మీ పత్రాన్ని పరిశీలిస్తుంది.', '/reporter/profile');
  return vid;
end $$;

-- Staff: verify / approve (activate) / reject / suspend / reinstate, and set category.
create or replace function review_reporter(p_user uuid, p_decision text, p_reason text default null, p_category text default null) returns reporter_profiles
language plpgsql security definer set search_path = public as $$
declare r reporter_profiles; new_status text;
begin
  select * into r from reporter_profiles where user_id = p_user for update;
  if r.user_id is null then raise exception 'Reporter not found'; end if;
  if not (my_role() in ('super_admin', 'editor') or has_permission('reporter_admin') or (my_role() = 'district_moderator' and moderates(r.district_id))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  new_status := case p_decision when 'verify' then 'verified' when 'approve' then 'active' when 'reject' then 'rejected'
                                when 'suspend' then 'suspended' when 'reinstate' then 'active' when 'pending' then 'verification_pending' else null end;
  if new_status is null then raise exception 'Unknown decision %', p_decision; end if;
  if p_decision in ('reject', 'suspend') and coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  if p_decision = 'approve' and r.status not in ('verified', 'verification_pending', 'registered', 'active') then raise exception 'Cannot approve a % reporter; reinstate instead', r.status; end if;
  if p_decision = 'verify' then
    update reporter_verifications set status = 'approved', reviewer_id = auth.uid(), reviewed_at = now()
      where id = (select id from reporter_verifications where user_id = p_user and status = 'pending' order by created_at desc limit 1);
  elsif p_decision = 'reject' then
    update reporter_verifications set status = 'rejected', reviewer_id = auth.uid(), reviewed_at = now(), review_note = p_reason where user_id = p_user and status = 'pending';
  end if;
  update reporter_profiles set status = case when p_decision = 'verify' and r.status = 'active' then 'active' else new_status end,
    status_reason = p_reason, category = coalesce(p_category, category), reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  where user_id = p_user returning * into r;
  perform audit('reporter_' || p_decision, 'reporter', p_user::text, jsonb_build_object('status', r.status, 'reason', p_reason, 'category', r.category));
  perform notify(p_user, 'verification',
    case r.status when 'active' then 'Your reporter account is active' when 'verified' then 'Your identity is verified'
      when 'rejected' then 'Your reporter application was not approved' when 'suspended' then 'Your reporter account is suspended' else 'Account updated' end,
    case r.status when 'active' then 'మీ రిపోర్టర్ ఖాతా సక్రియం అయింది' when 'verified' then 'మీ గుర్తింపు ధృవీకరించబడింది'
      when 'rejected' then 'మీ దరఖాస్తు ఆమోదించబడలేదు' when 'suspended' then 'మీ ఖాతా నిలిపివేయబడింది' else 'ఖాతా నవీకరించబడింది' end,
    p_reason, p_reason, '/reporter');
  return r;
end $$;

-- Keep the legacy profiles.verified_reporter flag (used by the reader app's Citizen Reporter
-- screen and storage policies) in sync with the reporter status.
create or replace function sync_verified_reporter() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set verified_reporter = (new.status in ('verified', 'active')) where id = new.user_id;
  return new;
end $$;
drop trigger if exists reporter_profiles_sync on reporter_profiles;
create trigger reporter_profiles_sync after insert or update of status on reporter_profiles for each row execute function sync_verified_reporter();

-- Public byline: no phone/email. Contributors are labelled as contributors, never as accredited journalists.
create or replace view reporter_public with (security_invoker = false) as
  select rp.user_id, rp.full_name as name, rp.district_id, rp.category,
    case rp.category
      when 'community_contributor' then 'Community Contributor'
      when 'verified_local_reporter' then 'Verified Local Reporter'
      when 'area_correspondent' then 'Area Correspondent'
      when 'senior_correspondent' then 'Senior Correspondent'
      else 'Editorial Contributor' end as category_label
  from reporter_profiles rp where rp.status in ('verified', 'active');

-- ════════════════════════════════════════════════════════════════════════════
-- 2. NEWS SUBMISSIONS (extends citizen_reports)
-- ════════════════════════════════════════════════════════════════════════════
create sequence if not exists submission_code_seq;

-- Convert the 3-value status enum to the full editorial workflow (pending → under_review).
do $$ begin
  if (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'citizen_reports' and column_name = 'status') = 'USER-DEFINED' then
    drop index if exists citizen_reports_status_district_id_submitted_at_idx;
    alter table citizen_reports alter column status drop default;
    alter table citizen_reports alter column status type text using (case status::text when 'pending' then 'under_review' when 'approved' then 'published' else status::text end);
  end if;
end $$;
alter table citizen_reports alter column status set default 'draft';
alter table citizen_reports drop constraint if exists citizen_reports_status_check;
alter table citizen_reports add constraint citizen_reports_status_check check (status in
  ('draft', 'submitted', 'ai_processing', 'under_review', 'correction_required', 'on_hold', 'approved', 'published', 'rejected'));

alter table citizen_reports
  add column if not exists code text,
  add column if not exists summary text,
  add column if not exists submission_type text not null default 'text_news',
  add column if not exists locality text,
  add column if not exists incident_location text,
  add column if not exists incident_at timestamptz,
  add column if not exists source_notes text,          -- confidential: reporter + editors only, never published
  add column if not exists assignment_id uuid,
  add column if not exists priority text not null default 'normal',
  add column if not exists is_sensitive boolean not null default false,
  add column if not exists sensitivity_reasons text[] not null default '{}',
  add column if not exists human_verified boolean not null default false,
  add column if not exists verification_notes text,
  add column if not exists duplicate_candidates jsonb not null default '[]',
  add column if not exists rights_confirmed boolean not null default false,
  add column if not exists rights_confirmed_at timestamptz,
  add column if not exists correction_note text,
  add column if not exists rejection_reason text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists published_at timestamptz;
alter table citizen_reports alter column submitted_at drop not null;
alter table citizen_reports alter column submitted_at drop default;
create unique index if not exists citizen_reports_code_key on citizen_reports (code);
create index if not exists citizen_reports_queue_idx on citizen_reports (status, district_id, submitted_at desc);
create index if not exists citizen_reports_reporter_idx on citizen_reports (reporter_id, created_at desc);
create index if not exists citizen_reports_headline_trgm on citizen_reports using gin (headline gin_trgm_ops);
alter table citizen_reports drop constraint if exists citizen_reports_priority_check;
alter table citizen_reports add constraint citizen_reports_priority_check check (priority in ('low', 'normal', 'high', 'urgent'));
alter table citizen_reports drop constraint if exists citizen_reports_type_check;
alter table citizen_reports add constraint citizen_reports_type_check check (submission_type in
  ('text_news', 'photo_story', 'video_story', 'voice_report', 'detailed_report', 'civic_issue', 'education', 'government', 'event', 'community', 'business_jobs'));
-- Existing rows from the reader app: treat as already-submitted.
update citizen_reports set code = coalesce(code, 'CHT-' || to_char(coalesce(submitted_at, now()), 'YYMM') || '-' || lpad(nextval('submission_code_seq')::text, 6, '0'))
  where code is null and status <> 'draft';

create table if not exists submission_media (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references citizen_reports on delete cascade,
  kind text not null check (kind in ('photo', 'video', 'audio', 'document')),
  bucket text not null default 'submissions',
  storage_path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes <= 104857600),
  duration_sec int,
  caption text,
  is_original boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists submission_media_sub_idx on submission_media (submission_id);

-- Editorial history: every decision, append-only.
create table if not exists editorial_reviews (
  id bigint generated always as identity primary key,
  submission_id uuid not null references citizen_reports on delete cascade,
  actor_id uuid references profiles,
  action text not null,
  from_status text,
  to_status text,
  note text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists editorial_reviews_sub_idx on editorial_reviews (submission_id, created_at);

create or replace function log_review(p_sub uuid, p_action text, p_from text, p_to text, p_note text default null, p_details jsonb default '{}', p_system boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into editorial_reviews (submission_id, actor_id, action, from_status, to_status, note, details)
  values (p_sub, case when p_system then null else auth.uid() end, p_action, p_from, p_to, p_note, coalesce(p_details, '{}'))
$$;

-- Sensitive-content screening (human verification required before publishing).
create or replace function sensitivity_reasons(p_category text, p_text text) returns text[] language plpgsql immutable as $$
declare r text[] := '{}';
begin
  if p_category = 'crime' then r := array_append(r, 'crime'::text); end if;
  if p_category = 'politics' then r := array_append(r, 'political'::text); end if;
  if p_category = 'health' then r := array_append(r, 'health'::text); end if;
  if p_text ~* '(murder|killed|rape|molest|assault|stabb|suicide|riot|communal|caste|religio|temple|mosque|church|allegation|alleged|accused|corrupt|bribe|scam|fraud|arrest|custody|outbreak|epidemic|death toll)' then r := array_append(r, 'serious_allegation_or_violence'::text); end if;
  if p_text ~ '(హత్య|అత్యాచారం|దాడి|ఆత్మహత్య|అల్లర్లు|మత|కుల|ఆరోపణ|అవినీతి|లంచం|మోసం|అరెస్ట్|అదుపులో)' then r := array_append(r, 'serious_allegation_or_violence'::text); end if;
  return (select coalesce(array_agg(distinct x), '{}') from unnest(r) x);
end $$;

create or replace function find_duplicates(p_id uuid, p_headline text, p_district text) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(d order by sc desc), '[]') from (
    select d, sc from (
      select jsonb_build_object('type', 'submission', 'id', c.id, 'code', c.code, 'headline', c.headline, 'score', round(similarity(lower(c.headline), lower(p_headline))::numeric, 2)) d,
             similarity(lower(c.headline), lower(p_headline)) sc
        from citizen_reports c
        where c.id <> p_id and c.status not in ('draft', 'rejected') and c.district_id = p_district
          and coalesce(c.submitted_at, c.created_at) > now() - interval '7 days'
          and similarity(lower(c.headline), lower(p_headline)) > 0.35
      union all
      select jsonb_build_object('type', 'story', 'id', s.id, 'headline', t.headline, 'score', round(similarity(lower(t.headline), lower(p_headline))::numeric, 2)),
             similarity(lower(t.headline), lower(p_headline))
        from stories s join story_translations t on t.story_id = s.id
        where s.district_id = p_district and s.published_at > now() - interval '7 days'
          and similarity(lower(t.headline), lower(p_headline)) > 0.35) u
    order by sc desc limit 5) x
$$;

-- BEFORE trigger: guards fields reporters may not touch, runs the submission pipeline.
create or replace function citizen_reports_before() returns trigger language plpgsql security definer set search_path = public as $$
-- Only editorial staff for this district bypass the reporter guards (the legacy 'reporter' staff role does not).
declare staff boolean := moderates(new.district_id); n_today int;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and not staff and auth.uid() is not null then
    -- reporters can only edit content of their own drafts / correction requests
    new.is_sensitive := old.is_sensitive; new.human_verified := old.human_verified; new.verification_notes := old.verification_notes;
    new.priority := old.priority; new.reviewer_id := old.reviewer_id; new.reviewed_at := old.reviewed_at; new.story_id := old.story_id;
    new.duplicate_candidates := old.duplicate_candidates; new.rejection_reason := old.rejection_reason; new.code := old.code;
    new.reporter_id := old.reporter_id; new.published_at := old.published_at;
    if old.status not in ('draft', 'correction_required') then raise exception 'This submission is with the editors and cannot be edited now'; end if;
    if new.status not in ('draft', 'correction_required', 'submitted') then new.status := old.status; end if;
  end if;
  if tg_op = 'INSERT' and not staff and auth.uid() is not null then
    new.reporter_id := auth.uid();
    if new.status not in ('draft', 'submitted') then new.status := 'draft'; end if;
    new.is_sensitive := false; new.human_verified := false; new.story_id := null; new.code := null;
  end if;

  -- Submission pipeline: SUBMITTED → AI PROCESSING (automatic checks) → UNDER REVIEW
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    if not reporter_can_submit(new.reporter_id) then raise exception 'Your reporter account must be verified before you can submit news'; end if;
    if not new.rights_confirmed then raise exception 'Please confirm you own this material and consent to publication'; end if;
    if length(trim(new.headline)) < 10 then raise exception 'Headline is too short'; end if;
    if length(trim(new.body)) < 40 then raise exception 'Please describe what happened in more detail'; end if;
    select count(*) into n_today from citizen_reports where reporter_id = new.reporter_id and submitted_at > now() - interval '1 day';
    if n_today >= setting_int('submissions_per_day_limit', 30) then raise exception 'Daily submission limit reached; please try again tomorrow'; end if;
    new.code := coalesce(new.code, 'CHT-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('submission_code_seq')::text, 6, '0'));
    new.submitted_at := now();
    new.rights_confirmed_at := coalesce(new.rights_confirmed_at, now());
    new.sensitivity_reasons := sensitivity_reasons(new.category_id, new.headline || ' ' || new.body);
    new.is_sensitive := cardinality(new.sensitivity_reasons) > 0;
    new.duplicate_candidates := find_duplicates(new.id, new.headline, new.district_id);
    new.ai_flags := array(select distinct x from unnest(new.ai_flags || case when new.is_sensitive then array['needs_human_verification'] else '{}' end
                                                 || case when jsonb_array_length(new.duplicate_candidates) > 0 then array['possible_duplicate'] else '{}' end) x);
    new.status := 'under_review';
  end if;
  return new;
end $$;
drop trigger if exists citizen_reports_before_trg on citizen_reports;
create trigger citizen_reports_before_trg before insert or update on citizen_reports for each row execute function citizen_reports_before();

-- AFTER trigger: history + notifications on status changes.
create or replace function citizen_reports_after() returns trigger language plpgsql security definer set search_path = public as $$
declare prev text := case when tg_op = 'INSERT' then null else old.status end;
begin
  if new.status is distinct from prev then
    if new.status = 'under_review' and (prev is null or prev in ('draft', 'correction_required', 'submitted')) then
      perform log_review(new.id, 'submitted', prev, 'submitted', null, '{}', false);
      perform log_review(new.id, 'automated_checks', 'submitted', 'ai_processing', null,
        jsonb_build_object('sensitive', new.is_sensitive, 'reasons', new.sensitivity_reasons, 'duplicates', jsonb_array_length(new.duplicate_candidates)), true);
      perform log_review(new.id, 'queued_for_review', 'ai_processing', 'under_review', null, '{}', true);
      perform notify(new.reporter_id, 'submission_received', 'Submission received · ' || new.code, 'వార్త అందింది · ' || new.code,
        'Editors will review "' || left(new.headline, 60) || '".', 'ఎడిటర్లు మీ వార్తను పరిశీలిస్తారు.', '/reporter/submissions/' || new.id);
      if new.assignment_id is not null then update reporter_assignments set status = 'submitted' where id = new.assignment_id and status in ('accepted', 'assigned', 'open'); end if;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists citizen_reports_after_trg on citizen_reports;
create trigger citizen_reports_after_trg after insert or update of status on citizen_reports for each row execute function citizen_reports_after();

-- ════════════════════════════════════════════════════════════════════════════
-- 3. RATE CARD + EARNINGS + LEDGER + WALLET
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists contribution_rates (
  code text primary key,
  label_en text not null,
  label_te text not null,
  min_paise bigint not null check (min_paise >= 0),
  max_paise bigint not null check (max_paise >= min_paise),
  admin_defined boolean not null default false,  -- amount set per assignment / award
  active boolean not null default true,
  sort int not null default 0,
  updated_by uuid references profiles,
  updated_at timestamptz not null default now()
);
insert into contribution_rates (code, label_en, label_te, min_paise, max_paise, admin_defined, sort) values
  ('text_news', 'Text news', 'వచన వార్త', 500, 500, false, 1),
  ('original_photo', 'Original photograph with verified information', 'ధృవీకరించిన సమాచారంతో అసలు ఫోటో', 1000, 1000, false, 2),
  ('original_video', 'Short original video', 'చిన్న అసలు వీడియో', 2500, 2500, false, 3),
  ('detailed_report', 'Detailed researched report', 'పరిశోధనాత్మక వివరణాత్మక కథనం', 5000, 10000, false, 4),
  ('special_assignment', 'Special assigned coverage', 'ప్రత్యేక అసైన్‌మెంట్ కవరేజ్', 0, 10000000, true, 5),
  ('bonus', 'Recognition bonus', 'గుర్తింపు బోనస్', 0, 10000000, true, 6)
on conflict (code) do nothing;

create or replace function update_rate(p_code text, p_min bigint, p_max bigint, p_active boolean, p_label_en text default null, p_label_te text default null)
returns contribution_rates language plpgsql security definer set search_path = public as $$
declare r contribution_rates;
begin
  if not has_permission('finance') then raise exception 'Only finance administrators can change the rate card' using errcode = '42501'; end if;
  if p_min < 0 or p_max < p_min or p_max > 10000000 then raise exception 'Invalid amount range'; end if;
  update contribution_rates set min_paise = p_min, max_paise = p_max, active = coalesce(p_active, active),
    label_en = coalesce(p_label_en, label_en), label_te = coalesce(p_label_te, label_te), updated_by = auth.uid(), updated_at = now()
  where code = p_code returning * into r;
  if r.code is null then raise exception 'Unknown rate %', p_code; end if;
  perform audit('rate_changed', 'contribution_rates', p_code, jsonb_build_object('min', p_min, 'max', p_max, 'active', r.active));
  return r;
end $$;

create sequence if not exists earning_code_seq;
create table if not exists reporter_earnings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('ERN-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('earning_code_seq')::text, 6, '0')),
  reporter_id uuid not null references profiles,
  submission_id uuid references citizen_reports,
  assignment_id uuid,
  award_id uuid,
  contribution_code text not null references contribution_rates,
  amount_paise bigint not null check (amount_paise > 0),
  status text not null default 'credited' check (status in ('credited', 'reversed')),
  approved_by uuid references profiles,
  approved_at timestamptz not null default now(),
  note text
);
-- One earning per submission, one special payment per assignment, one bonus per award.
create unique index if not exists reporter_earnings_submission_key on reporter_earnings (submission_id) where submission_id is not null;
create unique index if not exists reporter_earnings_assignment_key on reporter_earnings (assignment_id) where contribution_code = 'special_assignment';
create unique index if not exists reporter_earnings_award_key on reporter_earnings (award_id) where award_id is not null;
create index if not exists reporter_earnings_reporter_idx on reporter_earnings (reporter_id, approved_at desc);

create table if not exists wallet_accounts (
  reporter_id uuid primary key references profiles on delete restrict,
  available_paise bigint not null default 0 check (available_paise >= 0),
  reserved_paise bigint not null default 0 check (reserved_paise >= 0),
  paid_paise bigint not null default 0 check (paid_paise >= 0),
  lifetime_earned_paise bigint not null default 0 check (lifetime_earned_paise >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists wallet_ledger_entries (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references profiles on delete restrict,
  entry_type text not null check (entry_type in
    ('earning_credit', 'earning_reversal', 'withdrawal_reserve', 'withdrawal_release', 'payout_settle', 'payout_reversal_restore', 'adjustment')),
  available_delta bigint not null default 0,
  reserved_delta bigint not null default 0,
  paid_delta bigint not null default 0,
  earning_id uuid references reporter_earnings,
  withdrawal_id uuid,
  payment_transaction_id uuid,
  idempotency_key text not null unique,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists ledger_reporter_idx on wallet_ledger_entries (reporter_id, id desc);

-- Internal: the only way money moves. Locks the wallet row; refuses negative balances;
-- an idempotency key makes every posting happen at most once.
create or replace function ledger_post(p_reporter uuid, p_type text, p_available bigint, p_reserved bigint, p_paid bigint, p_key text,
  p_earning uuid default null, p_withdrawal uuid default null, p_txn uuid default null, p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare w wallet_accounts; eid bigint;
begin
  select id into eid from wallet_ledger_entries where idempotency_key = p_key;
  if eid is not null then return eid; end if;  -- already posted: no-op
  insert into wallet_accounts (reporter_id) values (p_reporter) on conflict do nothing;
  select * into w from wallet_accounts where reporter_id = p_reporter for update;
  if w.available_paise + p_available < 0 then raise exception 'Insufficient available balance' using errcode = 'P0001'; end if;
  if w.reserved_paise + p_reserved < 0 or w.paid_paise + p_paid < 0 then raise exception 'Ledger invariant violated for %', p_key; end if;
  update wallet_accounts set
    available_paise = available_paise + p_available,
    reserved_paise = reserved_paise + p_reserved,
    paid_paise = paid_paise + p_paid,
    lifetime_earned_paise = lifetime_earned_paise + case when p_type in ('earning_credit', 'earning_reversal', 'adjustment') then p_available else 0 end,
    updated_at = now()
  where reporter_id = p_reporter;
  insert into wallet_ledger_entries (reporter_id, entry_type, available_delta, reserved_delta, paid_delta, earning_id, withdrawal_id, payment_transaction_id, idempotency_key, note, created_by)
  values (p_reporter, p_type, p_available, p_reserved, p_paid, p_earning, p_withdrawal, p_txn, p_key, p_note, auth.uid()) returning id into eid;
  return eid;
end $$;

-- Internal: create an earning and credit it (one per submission / assignment / award).
create or replace function credit_earning(p_reporter uuid, p_code text, p_amount bigint, p_submission uuid, p_assignment uuid, p_award uuid, p_note text)
returns reporter_earnings language plpgsql security definer set search_path = public as $$
declare e reporter_earnings; rate contribution_rates;
begin
  select * into rate from contribution_rates where code = p_code;
  if rate.code is null or not rate.active then raise exception 'Contribution type % is not active', p_code; end if;
  if not rate.admin_defined and (p_amount < rate.min_paise or p_amount > rate.max_paise) then
    raise exception 'Amount for % must be between ₹% and ₹%', rate.label_en, to_char(rate.min_paise / 100.0, 'FM9999990.00'), to_char(rate.max_paise / 100.0, 'FM9999990.00');
  end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_submission is not null and exists (select 1 from reporter_earnings where submission_id = p_submission) then
    raise exception 'Earnings were already credited for this submission' using errcode = '23505';
  end if;
  insert into reporter_earnings (reporter_id, submission_id, assignment_id, award_id, contribution_code, amount_paise, approved_by, note)
  values (p_reporter, p_submission, case when p_code = 'special_assignment' then p_assignment end, p_award, p_code, p_amount, auth.uid(), p_note)
  returning * into e;
  perform ledger_post(p_reporter, 'earning_credit', p_amount, 0, 0, 'earning:' || e.id, e.id, null, null, rate.label_en);
  perform notify(p_reporter, 'earning', 'Earnings credited: ₹' || to_char(p_amount / 100.0, 'FM999990.00'), 'ఆదాయం జమ: ₹' || to_char(p_amount / 100.0, 'FM999990.00'),
    rate.label_en || ' · ' || e.code, rate.label_te || ' · ' || e.code, '/reporter/earnings');
  if (select available_paise from wallet_accounts where reporter_id = p_reporter) >= setting_int('withdrawal_threshold_paise', 30000)
     and (select available_paise - p_amount from wallet_accounts where reporter_id = p_reporter) < setting_int('withdrawal_threshold_paise', 30000) then
    perform notify(p_reporter, 'withdrawal_eligible', 'You can now withdraw your earnings', 'మీరు ఇప్పుడు మీ ఆదాయాన్ని ఉపసంహరించుకోవచ్చు',
      'Your available balance reached the withdrawal threshold.', 'మీ అందుబాటు బ్యాలెన్స్ ఉపసంహరణ పరిమితిని చేరింది.', '/reporter/withdraw');
  end if;
  return e;
end $$;

-- Finance: correct a mistaken earning (reverses only the unspent part).
create or replace function reverse_earning(p_earning uuid, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare e reporter_earnings;
begin
  if not has_permission('finance') then raise exception 'Finance permission required' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  select * into e from reporter_earnings where id = p_earning for update;
  if e.status <> 'credited' then raise exception 'Earning already reversed'; end if;
  perform ledger_post(e.reporter_id, 'earning_reversal', -e.amount_paise, 0, 0, 'earning_reversal:' || e.id, e.id, null, null, p_reason);
  update reporter_earnings set status = 'reversed', note = coalesce(note || ' · ', '') || 'Reversed: ' || p_reason where id = e.id;
  perform audit('earning_reversed', 'reporter_earnings', e.id::text, jsonb_build_object('reason', p_reason, 'amount_paise', e.amount_paise));
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. ASSIGNMENTS
-- ════════════════════════════════════════════════════════════════════════════
create sequence if not exists assignment_code_seq;
create table if not exists reporter_assignments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('ASG-' || lpad(nextval('assignment_code_seq')::text, 5, '0')),
  title text not null check (length(trim(title)) >= 5),
  description text not null,
  district_id text not null references districts,
  mandal_id text references mandals,
  locality text,
  deadline timestamptz,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_reporter_id uuid references profiles,
  media_required text[] not null default '{}' check (media_required <@ array['photo', 'video', 'audio', 'text']),
  special_amount_paise bigint not null default 0 check (special_amount_paise >= 0 and special_amount_paise <= 10000000),
  status text not null default 'open' check (status in ('open', 'assigned', 'accepted', 'submitted', 'completed', 'cancelled')),
  created_by uuid references profiles default auth.uid(),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reporter_assignments_idx on reporter_assignments (district_id, status, deadline);
alter table citizen_reports drop constraint if exists citizen_reports_assignment_fk;
alter table citizen_reports add constraint citizen_reports_assignment_fk foreign key (assignment_id) references reporter_assignments;

create or replace function assignments_after() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_reporter_id is not null and (tg_op = 'INSERT' or old.assigned_reporter_id is distinct from new.assigned_reporter_id) then
    perform notify(new.assigned_reporter_id, 'assignment', 'New assignment: ' || new.title, 'కొత్త అసైన్‌మెంట్: ' || new.title,
      coalesce('Deadline ' || to_char(new.deadline at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM'), null), null, '/reporter/assignments');
  elsif tg_op = 'INSERT' and new.assigned_reporter_id is null and new.status = 'open' then
    -- Open assignment: tell every active reporter covering that district.
    insert into notifications (user_id, kind, title_en, title_te, body_en, link)
    select distinct ra.user_id, 'assignment', 'Open assignment near you: ' || new.title, 'మీ ప్రాంతంలో అసైన్‌మెంట్: ' || new.title,
           coalesce('Deadline ' || to_char(new.deadline at time zone 'Asia/Kolkata', 'DD Mon, HH12:MI AM'), null), '/reporter/assignments'
    from reporter_areas ra join reporter_profiles rp on rp.user_id = ra.user_id
    where ra.district_id = new.district_id and rp.status = 'active';
  end if;
  return null;
end $$;
drop trigger if exists reporter_assignments_after on reporter_assignments;
create trigger reporter_assignments_after after insert or update of assigned_reporter_id on reporter_assignments for each row execute function assignments_after();

create or replace function accept_assignment(p_id uuid) returns reporter_assignments language plpgsql security definer set search_path = public as $$
declare a reporter_assignments;
begin
  if not reporter_can_submit(auth.uid()) then raise exception 'Your reporter account must be active to accept assignments'; end if;
  select * into a from reporter_assignments where id = p_id for update;
  if a.id is null then raise exception 'Assignment not found'; end if;
  if a.status not in ('open', 'assigned') then raise exception 'This assignment is no longer available'; end if;
  if a.assigned_reporter_id is not null and a.assigned_reporter_id <> auth.uid() then raise exception 'This assignment is assigned to another reporter'; end if;
  if a.deadline is not null and a.deadline < now() then raise exception 'The deadline for this assignment has passed'; end if;
  update reporter_assignments set status = 'accepted', assigned_reporter_id = auth.uid(), accepted_at = now() where id = p_id returning * into a;
  return a;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. EDITORIAL WORKFLOW
-- ════════════════════════════════════════════════════════════════════════════
create or replace function require_editor(p_district text) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not (moderates(p_district) or my_role() = 'super_admin') then raise exception 'You cannot review submissions for this district' using errcode = '42501'; end if;
end $$;

-- Request correction / hold / reject / back to review, with reasons.
create or replace function editorial_set_status(p_id uuid, p_status text, p_note text default null) returns citizen_reports
language plpgsql security definer set search_path = public as $$
declare c citizen_reports; prev text;
begin
  select * into c from citizen_reports where id = p_id for update;
  if c.id is null then raise exception 'Submission not found'; end if;
  perform require_editor(c.district_id);
  if p_status not in ('under_review', 'correction_required', 'on_hold', 'rejected') then raise exception 'Use editorial_approve to approve or publish'; end if;
  if c.status in ('published', 'draft') then raise exception 'A % submission cannot be moved to %', c.status, p_status; end if;
  if p_status in ('correction_required', 'rejected') and coalesce(trim(p_note), '') = '' then raise exception 'Please give the reporter a reason'; end if;
  prev := c.status;
  update citizen_reports set status = p_status, reviewer_id = auth.uid(), reviewed_at = now(),
    correction_note = case when p_status = 'correction_required' then p_note else correction_note end,
    rejection_reason = case when p_status = 'rejected' then p_note else rejection_reason end
  where id = p_id returning * into c;
  perform log_review(p_id, case p_status when 'correction_required' then 'request_correction' when 'on_hold' then 'hold' when 'rejected' then 'reject' else 'reopen' end, prev, p_status, p_note);
  if p_status = 'correction_required' then
    perform notify(c.reporter_id, 'correction', 'Correction requested · ' || c.code, 'సవరణ అవసరం · ' || c.code, p_note, p_note, '/reporter/submissions/' || c.id);
  elsif p_status = 'rejected' then
    perform notify(c.reporter_id, 'rejected', 'Submission not accepted · ' || c.code, 'వార్త ఆమోదించబడలేదు · ' || c.code, p_note, p_note, '/reporter/submissions/' || c.id);
  elsif p_status = 'under_review' and prev <> 'under_review' then
    perform notify(c.reporter_id, 'review', 'Your story is under review · ' || c.code, 'మీ వార్త పరిశీలనలో ఉంది · ' || c.code, null, null, '/reporter/submissions/' || c.id);
  end if;
  return c;
end $$;

-- Edit content / priority / verification checklist (all logged).
create or replace function editorial_update(p_id uuid, p_patch jsonb) returns citizen_reports
language plpgsql security definer set search_path = public as $$
declare c citizen_reports;
begin
  select * into c from citizen_reports where id = p_id for update;
  if c.id is null then raise exception 'Submission not found'; end if;
  perform require_editor(c.district_id);
  if c.status in ('published', 'rejected') and (p_patch ?| array['headline', 'body', 'summary', 'category_id']) then
    raise exception 'A % submission can no longer be edited here; edit the published story instead', c.status;
  end if;
  if c.is_sensitive and (p_patch->>'is_sensitive')::boolean is false and coalesce(trim(p_patch->>'verification_notes'), '') = '' then
    raise exception 'Explain why this story is not sensitive before clearing the flag';
  end if;
  update citizen_reports set
    headline = coalesce(p_patch->>'headline', headline),
    body = coalesce(p_patch->>'body', body),
    summary = coalesce(p_patch->>'summary', summary),
    category_id = coalesce(p_patch->>'category_id', category_id),
    priority = coalesce(p_patch->>'priority', priority),
    is_sensitive = coalesce((p_patch->>'is_sensitive')::boolean, is_sensitive),
    human_verified = coalesce((p_patch->>'human_verified')::boolean, human_verified),
    verification_notes = coalesce(p_patch->>'verification_notes', verification_notes)
  where id = p_id returning * into c;
  perform log_review(p_id, case when p_patch ? 'human_verified' then 'verify_source' when p_patch ? 'priority' and (select count(*) from jsonb_object_keys(p_patch)) = 1 then 'set_priority' else 'edit' end,
    c.status, c.status, p_patch->>'verification_notes', p_patch - 'body');
  return c;
end $$;

-- Approve (credit earnings) and optionally publish. Sensitive stories need human verification.
create or replace function editorial_approve(
  p_id uuid, p_headline text, p_summary text, p_contribution text, p_amount_paise bigint,
  p_publish boolean default true, p_image_path text default null, p_note text default null, p_translations jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare c citizen_reports; sid text; e reporter_earnings; prev text; a reporter_assignments; amount bigint := p_amount_paise; k text; v jsonb;
begin
  select * into c from citizen_reports where id = p_id for update;
  if c.id is null then raise exception 'Submission not found'; end if;
  perform require_editor(c.district_id);
  if c.status not in ('under_review', 'on_hold', 'approved') then raise exception 'Only submissions under review can be approved (this one is %)', c.status; end if;
  if c.is_sensitive and not c.human_verified then
    raise exception 'Sensitive story: an editor must confirm human verification of the facts and sources before approval';
  end if;
  if exists (select 1 from reporter_profiles where user_id = c.reporter_id and status in ('suspended', 'rejected')) then
    raise exception 'The reporter account is suspended or rejected; resolve that before approving';
  end if;
  if coalesce(array_length(regexp_split_to_array(trim(coalesce(p_summary, '')), '\s+'), 1), 0) not between 30 and 100 or coalesce(trim(p_summary), '') = '' then
    raise exception 'The published summary must be 30–100 words (60–80 recommended)';
  end if;
  if coalesce(length(trim(p_headline)), 0) < 10 then raise exception 'Headline is too short'; end if;
  prev := c.status;

  -- Earnings (once per submission; assignment special payments once per assignment)
  if c.status <> 'approved' and p_contribution is not null and p_contribution <> 'none' then
    if p_contribution = 'special_assignment' then
      select * into a from reporter_assignments where id = c.assignment_id for update;
      if a.id is null then raise exception 'This submission is not linked to an assignment'; end if;
      amount := a.special_amount_paise;
      if amount <= 0 then raise exception 'The assignment has no special payment amount'; end if;
      if exists (select 1 from reporter_earnings where assignment_id = a.id and contribution_code = 'special_assignment') then
        raise exception 'The special payment for this assignment was already credited';
      end if;
    end if;
    e := credit_earning(c.reporter_id, p_contribution, amount, c.id, c.assignment_id, null, coalesce(c.code, '') || ' ' || left(p_headline, 60));
  end if;

  -- Story (draft when approved-only, published when publishing)
  if c.story_id is null then
    insert into stories (category_id, state_id, district_id, mandal_id, image_path, source, status, published_at, citizen_report_id, author_id, geo)
    select c.category_id, d.state_id, c.district_id, c.mandal_id,
           coalesce(p_image_path, c.media[1], 'stories/placeholder.jpg'), 'Citizen Reporter',
           (case when p_publish then 'published' else 'draft' end)::story_status, case when p_publish then now() end, c.id, c.reporter_id,
           (select geo from mandals where id = c.mandal_id)
    from districts d where d.id = c.district_id returning id into sid;
  else
    sid := c.story_id;
    update stories set status = (case when p_publish then 'published' else status::text end)::story_status,
      published_at = case when p_publish then coalesce(published_at, now()) else published_at end,
      image_path = coalesce(p_image_path, image_path) where id = sid;
  end if;
  insert into story_translations (story_id, lang, headline, summary) values (sid, c.lang, p_headline, p_summary)
    on conflict (story_id, lang) do update set headline = excluded.headline, summary = excluded.summary;
  for k, v in select * from jsonb_each(coalesce(p_translations, '{}')) loop
    insert into story_translations (story_id, lang, headline, summary, machine_translated) values (sid, k, v->>'headline', v->>'summary', coalesce((v->>'machine')::boolean, true))
      on conflict (story_id, lang) do update set headline = excluded.headline, summary = excluded.summary;
  end loop;

  update citizen_reports set status = case when p_publish then 'published' else 'approved' end, story_id = sid, reviewer_id = auth.uid(), reviewed_at = now(),
    review_note = coalesce(p_note, review_note), published_at = case when p_publish then now() else published_at end
  where id = p_id;
  if c.assignment_id is not null then update reporter_assignments set status = 'completed' where id = c.assignment_id; end if;

  if prev <> 'approved' then
    perform log_review(p_id, 'approve', prev, 'approved', p_note, jsonb_build_object('contribution', p_contribution, 'amount_paise', coalesce(e.amount_paise, 0), 'earning', e.code));
    perform notify(c.reporter_id, 'approved', 'Story approved · ' || c.code, 'వార్త ఆమోదించబడింది · ' || c.code, p_headline, p_headline, '/reporter/submissions/' || c.id);
  end if;
  if p_publish then
    perform log_review(p_id, 'publish', 'approved', 'published', null, jsonb_build_object('story_id', sid));
    perform notify(c.reporter_id, 'published', 'Your story is live', 'మీ వార్త ప్రచురించబడింది', p_headline, p_headline, '/story/' || sid);
  end if;
  return jsonb_build_object('story_id', sid, 'earning', case when e.id is null then null else jsonb_build_object('code', e.code, 'amount_paise', e.amount_paise) end);
end $$;

-- Legacy CMS/app entry point now routes through the full workflow.
create or replace function approve_report(p_report uuid, p_headline text, p_summary text, p_image_path text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
begin
  return editorial_approve(p_report, p_headline, p_summary, 'none', 0, true, p_image_path, p_note) ->> 'story_id';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. PAYOUT METHODS, WITHDRAWALS, PAYMENTS
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists payout_methods (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles on delete cascade,
  kind text not null check (kind in ('upi', 'bank')),
  holder_name text not null,
  masked text not null,                  -- e.g. ra•••@okaxis / ••••••4321
  ifsc text check (ifsc is null or ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  bank_name text,
  fingerprint text not null,             -- keyed hash of the full details, for duplicate detection
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'failed')),
  verification_note text,
  verified_by uuid references profiles,
  verified_at timestamptz,
  provider_contact_id text,
  provider_fund_account_id text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists payout_methods_fp_key on payout_methods (reporter_id, fingerprint) where active;
-- Full account/UPI details, AES-GCM encrypted by the payout-methods Edge Function.
-- RLS is on with no policies: only the service role (Edge Functions) can read it.
create table if not exists payout_method_secrets (
  method_id uuid primary key references payout_methods on delete cascade,
  ciphertext text not null,
  key_version int not null default 1,
  created_at timestamptz not null default now()
);

create or replace function verify_payout_method(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare m payout_methods;
begin
  if not has_permission('finance') then raise exception 'Finance permission required' using errcode = '42501'; end if;
  if p_status not in ('verified', 'failed') then raise exception 'Status must be verified or failed'; end if;
  select * into m from payout_methods where id = p_id for update;
  if m.id is null then raise exception 'Payment method not found'; end if;
  if m.reporter_id = auth.uid() then raise exception 'You cannot verify your own payment method'; end if;
  update payout_methods set verification_status = p_status, verification_note = p_note, verified_by = auth.uid(), verified_at = now() where id = p_id returning * into m;
  perform audit('payout_method_' || p_status, 'payout_methods', p_id::text, jsonb_build_object('note', p_note));
  perform notify(m.reporter_id, 'payout_method', case when p_status = 'verified' then 'Payment method verified' else 'Payment method could not be verified' end,
    case when p_status = 'verified' then 'చెల్లింపు విధానం ధృవీకరించబడింది' else 'చెల్లింపు విధానం ధృవీకరించబడలేదు' end, m.masked || coalesce(' · ' || p_note, ''), null, '/reporter/withdraw');
end $$;

create or replace function deactivate_payout_method(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from withdrawal_requests where payout_method_id = p_id and status in ('requested', 'under_review', 'approved', 'processing')) then
    raise exception 'This method is used by a withdrawal in progress';
  end if;
  update payout_methods set active = false, is_default = false where id = p_id and reporter_id = auth.uid();
  if not found then raise exception 'Payment method not found'; end if;
end $$;

create sequence if not exists withdrawal_code_seq;
create table if not exists withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('WDR-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('withdrawal_code_seq')::text, 6, '0')),
  reporter_id uuid not null references profiles,
  amount_paise bigint not null check (amount_paise >= 100),
  payout_method_id uuid not null references payout_methods,
  method_snapshot jsonb not null default '{}',     -- masked details at request time
  status text not null default 'requested' check (status in
    ('requested', 'under_review', 'approved', 'processing', 'paid', 'failed', 'rejected', 'reversed', 'cancelled')),
  reason text,
  needs_reconciliation boolean not null default false,
  reviewed_by uuid references profiles,
  reviewed_at timestamptz,
  reconciled_by uuid references profiles,
  reconciled_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists withdrawal_requests_status_idx on withdrawal_requests (status, created_at desc);
create index if not exists withdrawal_requests_reporter_idx on withdrawal_requests (reporter_id, created_at desc);
alter table wallet_ledger_entries drop constraint if exists ledger_withdrawal_fk;
alter table wallet_ledger_entries add constraint ledger_withdrawal_fk foreign key (withdrawal_id) references withdrawal_requests;

create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references withdrawal_requests,
  provider text not null check (provider in ('razorpayx', 'mock', 'manual')),
  provider_mode text not null default 'test' check (provider_mode in ('test', 'live')),
  payout_mode text,                         -- UPI / IMPS / NEFT
  idempotency_key text not null unique,
  provider_payout_id text unique,
  status text not null default 'initiating', -- initiating | queued | pending | processing | processed | reversed | failed | rejected | cancelled | error
  utr text,
  amount_paise bigint not null,
  fees_paise bigint, tax_paise bigint,
  failure_reason text,
  request_payload jsonb not null default '{}',   -- sanitised: never contains account numbers
  response_payload jsonb not null default '{}',
  created_by uuid references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_transactions_wd_idx on payment_transactions (withdrawal_id, created_at desc);
alter table wallet_ledger_entries drop constraint if exists ledger_txn_fk;
alter table wallet_ledger_entries add constraint ledger_txn_fk foreign key (payment_transaction_id) references payment_transactions;

create table if not exists payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null unique,
  event_type text,
  provider_payout_id text,
  signature_valid boolean not null,
  payload jsonb not null default '{}',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  result text
);

-- Reporter: request a withdrawal. Reserves the amount immediately so two requests
-- can never spend the same balance (the wallet row is locked for the duration).
create or replace function request_withdrawal(p_amount_paise bigint, p_method uuid) returns withdrawal_requests
language plpgsql security definer set search_path = public as $$
declare w wallet_accounts; m payout_methods; r withdrawal_requests; threshold bigint := setting_int('withdrawal_threshold_paise', 30000); rp reporter_profiles;
begin
  select * into rp from reporter_profiles where user_id = auth.uid();
  if rp.user_id is null or rp.status not in ('active', 'verified') then raise exception 'Only active reporters can withdraw earnings'; end if;
  if not exists (select 1 from reporter_verifications where user_id = auth.uid() and status = 'approved') then
    raise exception 'Complete identity verification before your first withdrawal';
  end if;
  select * into m from payout_methods where id = p_method and reporter_id = auth.uid() and active;
  if m.id is null then raise exception 'Choose one of your payment methods'; end if;
  if m.verification_status <> 'verified' then raise exception 'This payment method is not verified yet'; end if;
  insert into wallet_accounts (reporter_id) values (auth.uid()) on conflict do nothing;
  select * into w from wallet_accounts where reporter_id = auth.uid() for update;
  if (select count(*) from withdrawal_requests where reporter_id = auth.uid() and status in ('requested', 'under_review', 'approved', 'processing')) >= setting_int('max_open_withdrawals', 2) then
    raise exception 'You already have withdrawals in progress';
  end if;
  if w.available_paise < threshold then
    raise exception 'Minimum balance for withdrawal is ₹%. Your available balance is ₹%', threshold / 100, to_char(w.available_paise / 100.0, 'FM999999990.00');
  end if;
  if p_amount_paise < threshold then raise exception 'Minimum withdrawal is ₹%', threshold / 100; end if;
  if p_amount_paise > w.available_paise then raise exception 'Amount exceeds your available balance'; end if;
  insert into withdrawal_requests (reporter_id, amount_paise, payout_method_id, method_snapshot)
  values (auth.uid(), p_amount_paise, m.id, jsonb_build_object('kind', m.kind, 'masked', m.masked, 'holder_name', m.holder_name, 'bank_name', m.bank_name, 'ifsc', m.ifsc))
  returning * into r;
  perform ledger_post(auth.uid(), 'withdrawal_reserve', -p_amount_paise, p_amount_paise, 0, 'reserve:' || r.id, null, r.id, null, r.code);
  perform audit('withdrawal_requested', 'withdrawal_requests', r.id::text, jsonb_build_object('amount_paise', p_amount_paise));
  perform notify(auth.uid(), 'withdrawal', 'Withdrawal requested · ' || r.code, 'ఉపసంహరణ అభ్యర్థన · ' || r.code,
    '₹' || to_char(p_amount_paise / 100.0, 'FM999999990.00') || ' to ' || m.masked, null, '/reporter/history');
  perform notify_finance('finance_withdrawal', 'New withdrawal request ' || r.code, rp.full_name || ' · ₹' || to_char(p_amount_paise / 100.0, 'FM999999990.00'), '/finance');
  return r;
end $$;

create or replace function cancel_withdrawal(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare r withdrawal_requests;
begin
  select * into r from withdrawal_requests where id = p_id and reporter_id = auth.uid() for update;
  if r.id is null then raise exception 'Withdrawal not found'; end if;
  if r.status not in ('requested', 'under_review') then raise exception 'This withdrawal can no longer be cancelled'; end if;
  update withdrawal_requests set status = 'cancelled', updated_at = now() where id = p_id;
  perform ledger_post(r.reporter_id, 'withdrawal_release', r.amount_paise, -r.amount_paise, 0, 'release:' || r.id, null, r.id, null, 'Cancelled by reporter');
end $$;

-- Finance: approve / reject / mark under review.
create or replace function finance_review_withdrawal(p_id uuid, p_decision text, p_reason text default null) returns withdrawal_requests
language plpgsql security definer set search_path = public as $$
declare r withdrawal_requests;
begin
  if not has_permission('finance') then raise exception 'Finance permission required' using errcode = '42501'; end if;
  select * into r from withdrawal_requests where id = p_id for update;
  if r.id is null then raise exception 'Withdrawal not found'; end if;
  if r.reporter_id = auth.uid() then raise exception 'You cannot approve your own withdrawal'; end if;
  if p_decision = 'under_review' then
    if r.status <> 'requested' then raise exception 'Withdrawal is %', r.status; end if;
    update withdrawal_requests set status = 'under_review', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() where id = p_id returning * into r;
  elsif p_decision = 'approve' then
    if r.status not in ('requested', 'under_review') then raise exception 'Withdrawal is %', r.status; end if;
    if (select verification_status from payout_methods where id = r.payout_method_id) <> 'verified' then raise exception 'The payment method is not verified'; end if;
    update withdrawal_requests set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() where id = p_id returning * into r;
    perform notify(r.reporter_id, 'withdrawal', 'Withdrawal approved · ' || r.code, 'ఉపసంహరణ ఆమోదించబడింది · ' || r.code, 'Payment will be sent shortly.', 'చెల్లింపు త్వరలో పంపబడుతుంది.', '/reporter/history');
  elsif p_decision = 'reject' then
    if r.status not in ('requested', 'under_review', 'approved') then raise exception 'Withdrawal is %', r.status; end if;
    if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
    update withdrawal_requests set status = 'rejected', reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now() where id = p_id returning * into r;
    perform ledger_post(r.reporter_id, 'withdrawal_release', r.amount_paise, -r.amount_paise, 0, 'release:' || r.id, null, r.id, null, 'Rejected: ' || p_reason);
    perform notify(r.reporter_id, 'withdrawal', 'Withdrawal rejected · ' || r.code, 'ఉపసంహరణ తిరస్కరించబడింది · ' || r.code, p_reason, p_reason, '/reporter/history');
  else
    raise exception 'Unknown decision %', p_decision;
  end if;
  perform audit('withdrawal_' || p_decision, 'withdrawal_requests', p_id::text, jsonb_build_object('reason', p_reason, 'amount_paise', r.amount_paise));
  return r;
end $$;

-- Service role (payouts Edge Function): record that a payout was sent to the provider.
create or replace function mark_withdrawal_processing(p_id uuid, p_txn uuid, p_actor uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update withdrawal_requests set status = 'processing', updated_at = now() where id = p_id and status in ('approved', 'processing');
  if not found then raise exception 'Withdrawal must be approved before payout'; end if;
  insert into audit_logs (actor_id, action, entity, entity_id, details) values (p_actor, 'payout_initiated', 'withdrawal_requests', p_id::text, jsonb_build_object('transaction', p_txn));
end $$;

-- Service role: apply a provider payout status (from a verified webhook or an API fetch).
-- Never restores balance by itself on failure — that waits for reconciliation.
create or replace function apply_payout_status(p_txn uuid, p_status text, p_utr text, p_failure text, p_fees bigint, p_tax bigint, p_response jsonb, p_source text)
returns text language plpgsql security definer set search_path = public as $$
declare t payment_transactions; r withdrawal_requests; result text := 'ignored';
begin
  select * into t from payment_transactions where id = p_txn for update;
  if t.id is null then return 'unknown_transaction'; end if;
  select * into r from withdrawal_requests where id = t.withdrawal_id for update;
  -- do not let a late "processing" event overwrite a terminal state (webhooks may arrive out of order)
  if t.status in ('processed', 'reversed', 'failed', 'rejected', 'cancelled') and p_status in ('queued', 'pending', 'processing', 'initiated', 'scheduled') then
    return 'stale_event_ignored';
  end if;
  update payment_transactions set status = p_status, utr = coalesce(p_utr, utr), failure_reason = coalesce(p_failure, failure_reason),
    fees_paise = coalesce(p_fees, fees_paise), tax_paise = coalesce(p_tax, tax_paise),
    response_payload = coalesce(p_response, response_payload), updated_at = now()
  where id = p_txn;

  if p_status = 'processed' then
    if r.status = 'processing' or (r.status = 'failed' and r.needs_reconciliation) then
      perform ledger_post(r.reporter_id, 'payout_settle', 0, -r.amount_paise, r.amount_paise, 'settle:' || r.id, null, r.id, p_txn, coalesce('UTR ' || p_utr, 'Paid'));
      update withdrawal_requests set status = 'paid', paid_at = now(), needs_reconciliation = false, updated_at = now() where id = r.id;
      perform notify(r.reporter_id, 'payment', 'Payment sent · ₹' || to_char(r.amount_paise / 100.0, 'FM999999990.00'), 'చెల్లింపు పంపబడింది · ₹' || to_char(r.amount_paise / 100.0, 'FM999999990.00'),
        coalesce('UTR ' || p_utr, r.code), coalesce('UTR ' || p_utr, r.code), '/reporter/history');
      result := 'settled';
    elsif r.status in ('failed', 'reversed') and not r.needs_reconciliation then
      -- provider says paid, but we already restored the balance: never auto-debit, flag for finance
      update withdrawal_requests set needs_reconciliation = true, reason = 'Provider reports PROCESSED after the balance was restored. Investigate before any further action.', updated_at = now() where id = r.id;
      perform notify_finance('finance_payout_conflict', 'Payout conflict ' || r.code, 'Processed after balance restore', '/finance');
      result := 'conflict_flagged';
    end if;
  elsif p_status in ('failed', 'rejected', 'cancelled') then
    if r.status in ('processing', 'approved') then
      update withdrawal_requests set status = 'failed', reason = coalesce(p_failure, p_status), needs_reconciliation = true, updated_at = now() where id = r.id;
      perform notify(r.reporter_id, 'payment_failed', 'Payment failed · ' || r.code, 'చెల్లింపు విఫలమైంది · ' || r.code,
        'We will restore the amount to your balance after checking with the bank.', 'బ్యాంకుతో తనిఖీ చేసిన తర్వాత మొత్తం మీ బ్యాలెన్స్‌కు తిరిగి జమ అవుతుంది.', '/reporter/history');
      perform notify_finance('finance_payout_failed', 'Payout failed ' || r.code, coalesce(p_failure, p_status), '/finance');
      result := 'failed_pending_reconciliation';
    end if;
  elsif p_status = 'reversed' then
    if r.status in ('paid', 'processing', 'failed') then
      update withdrawal_requests set status = 'reversed', reason = coalesce(p_failure, 'Reversed by bank'), needs_reconciliation = true, updated_at = now() where id = r.id;
      perform notify(r.reporter_id, 'payment_failed', 'Payment reversed · ' || r.code, 'చెల్లింపు వెనక్కి వచ్చింది · ' || r.code,
        'The bank returned this payment. We will restore your balance after reconciliation.', 'బ్యాంకు ఈ చెల్లింపును తిరిగి పంపింది.', '/reporter/history');
      perform notify_finance('finance_payout_reversed', 'Payout reversed ' || r.code, coalesce(p_failure, 'reversed'), '/finance');
      result := 'reversed_pending_reconciliation';
    end if;
  else
    result := 'status_updated';
  end if;
  insert into audit_logs (actor_id, action, entity, entity_id, details)
  values (null, 'payout_status_' || p_status, 'withdrawal_requests', r.id::text, jsonb_build_object('source', p_source, 'transaction', p_txn, 'result', result));
  return result;
end $$;

-- Finance / service role: after confirming with the provider that a payout failed or was
-- reversed, restore the reporter's balance (exactly once).
create or replace function reconcile_withdrawal(p_id uuid, p_confirmed_status text, p_note text, p_actor uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare r withdrawal_requests; was_paid boolean;
begin
  if not (has_permission('finance') or is_service_caller()) then raise exception 'Finance permission required' using errcode = '42501'; end if;
  select * into r from withdrawal_requests where id = p_id for update;
  if r.id is null then raise exception 'Withdrawal not found'; end if;
  if not r.needs_reconciliation then return 'nothing_to_reconcile'; end if;
  if p_confirmed_status not in ('failed', 'reversed', 'rejected', 'cancelled') then raise exception 'Only a confirmed failure or reversal can be reconciled'; end if;
  was_paid := exists (select 1 from wallet_ledger_entries where idempotency_key = 'settle:' || r.id);
  if was_paid then
    perform ledger_post(r.reporter_id, 'payout_reversal_restore', r.amount_paise, 0, -r.amount_paise, 'restore:' || r.id, null, r.id, null, p_note);
  else
    perform ledger_post(r.reporter_id, 'withdrawal_release', r.amount_paise, -r.amount_paise, 0, 'release:' || r.id, null, r.id, null, p_note);
  end if;
  update withdrawal_requests set needs_reconciliation = false, reconciled_by = coalesce(auth.uid(), p_actor), reconciled_at = now(), updated_at = now(),
    status = case when r.status = 'paid' then 'reversed' else r.status end where id = p_id;
  insert into audit_logs (actor_id, action, entity, entity_id, details) values (coalesce(auth.uid(), p_actor), 'withdrawal_reconciled', 'withdrawal_requests', p_id::text,
    jsonb_build_object('confirmed_status', p_confirmed_status, 'note', p_note, 'restored_paise', r.amount_paise));
  perform notify(r.reporter_id, 'payment', 'Amount restored to your balance', 'మొత్తం మీ బ్యాలెన్స్‌కు తిరిగి జమ అయింది',
    '₹' || to_char(r.amount_paise / 100.0, 'FM999999990.00') || ' · ' || r.code, null, '/reporter/earnings');
  return 'restored';
end $$;

-- Finance: record a payout made outside the system (bank portal / CSV batch).
create or replace function record_manual_payout(p_id uuid, p_utr text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r withdrawal_requests; tid uuid;
begin
  if not has_permission('finance') then raise exception 'Finance permission required' using errcode = '42501'; end if;
  if coalesce(trim(p_utr), '') = '' then raise exception 'Enter the bank UTR / reference number'; end if;
  select * into r from withdrawal_requests where id = p_id for update;
  if r.status not in ('approved') then raise exception 'Only approved withdrawals can be marked paid manually (this one is %)', r.status; end if;
  insert into payment_transactions (withdrawal_id, provider, provider_mode, idempotency_key, status, utr, amount_paise, created_by, request_payload)
  values (p_id, 'manual', 'live', 'manual:' || p_id, 'processed', trim(p_utr), r.amount_paise, auth.uid(), jsonb_build_object('note', p_note)) returning id into tid;
  update withdrawal_requests set status = 'processing' where id = p_id;
  perform apply_payout_status(tid, 'processed', trim(p_utr), null, null, null, null, 'manual');
  perform audit('manual_payout_recorded', 'withdrawal_requests', p_id::text, jsonb_build_object('utr', p_utr, 'note', p_note));
end $$;

-- Finance: record that a manual payout bounced (then reconcile to restore).
create or replace function record_manual_failure(p_id uuid, p_status text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if not has_permission('finance') then raise exception 'Finance permission required' using errcode = '42501'; end if;
  select id into t from payment_transactions where withdrawal_id = p_id and provider = 'manual' order by created_at desc limit 1;
  if t is null then raise exception 'No manual payout recorded for this withdrawal'; end if;
  perform apply_payout_status(t, p_status, null, p_reason, null, null, null, 'manual');
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. RECOGNITION
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists contributor_badges (
  code text primary key, name_en text not null, name_te text not null, description text, icon text, active boolean not null default true
);
insert into contributor_badges (code, name_en, name_te, description, icon) values
  ('best_reporter_month', 'Best Reporter of the Month', 'నెల ఉత్తమ రిపోర్టర్', 'Highest quality-weighted score in a month', 'trophy'),
  ('accuracy_champion', 'Accuracy Champion', 'ఖచ్చితత్వ ఛాంపియన్', 'No corrections or rejections with consistent output', 'check'),
  ('best_original_video', 'Best Original Video', 'ఉత్తమ అసలు వీడియో', 'Outstanding original video coverage', 'video'),
  ('community_voice', 'Community Voice', 'సమాజ గొంతు', 'Stories that brought a community issue to light', 'megaphone'),
  ('consistent_contributor', 'Consistent Contributor', 'నిరంతర సహకారి', 'Approved stories in at least 4 different weeks', 'calendar'),
  ('civic_champion', 'Civic Reporting Champion', 'పౌర సమస్యల ఛాంపియన్', 'Civic issues reported and followed up', 'building')
on conflict (code) do nothing;

create table if not exists badge_awards (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles on delete cascade,
  badge_code text not null references contributor_badges,
  period date not null default date_trunc('month', now())::date,
  reason text,
  bonus_paise bigint not null default 0 check (bonus_paise >= 0 and bonus_paise <= 5000000),
  earning_id uuid references reporter_earnings,
  awarded_by uuid references profiles,
  created_at timestamptz not null default now(),
  unique (reporter_id, badge_code, period)
);

-- Quality-weighted monthly score: approvals count only after accuracy, originality and
-- consistency are considered, and per-day volume is capped so volume alone can't win.
create or replace function reporter_scores(p_month date default date_trunc('month', now())::date)
returns table (reporter_id uuid, name text, district_id text, category text, approved int, rejected int, corrections int,
               original_media int, active_weeks int, accuracy numeric, score numeric)
language sql stable security definer set search_path = public as $$
  with subs as (
    select c.*, (select count(*) from submission_media m where m.submission_id = c.id and m.is_original and m.kind in ('photo', 'video')) as media_n,
           row_number() over (partition by c.reporter_id, date_trunc('day', c.submitted_at) order by c.submitted_at) as nth_of_day
    from citizen_reports c
    where c.submitted_at >= p_month and c.submitted_at < (p_month + interval '1 month')),
  agg as (
    select s.reporter_id,
      count(*) filter (where s.status in ('approved', 'published') and s.nth_of_day <= 5)::int as approved,
      count(*) filter (where s.status = 'rejected')::int as rejected,
      (select count(*) from editorial_reviews er join citizen_reports c2 on c2.id = er.submission_id
        where c2.reporter_id = s.reporter_id and er.action = 'request_correction' and er.created_at >= p_month and er.created_at < p_month + interval '1 month')::int as corrections,
      count(*) filter (where s.status in ('approved', 'published') and s.media_n > 0)::int as original_media,
      count(distinct date_trunc('week', s.submitted_at)) filter (where s.status in ('approved', 'published'))::int as active_weeks
    from subs s group by s.reporter_id)
  select a.reporter_id, rp.full_name, rp.district_id, rp.category, a.approved, a.rejected, a.corrections, a.original_media, a.active_weeks,
    round(case when a.approved + a.rejected = 0 then 0 else a.approved::numeric / (a.approved + a.rejected) end, 2) as accuracy,
    round(((a.approved * 10 + a.original_media * 6 + a.active_weeks * 8 - a.corrections * 3)
           * case when a.approved + a.rejected = 0 then 0 else a.approved::numeric / (a.approved + a.rejected) end)::numeric, 1) as score
  from agg a join reporter_profiles rp on rp.user_id = a.reporter_id
  where rp.status in ('verified', 'active')
  order by score desc
$$;

create or replace function reporter_level(p_user uuid) returns text language sql stable security definer set search_path = public as $$
  with s as (
    select count(*) filter (where status in ('approved', 'published')) a, count(*) filter (where status = 'rejected') r,
           min(submitted_at) filter (where status in ('approved', 'published')) first_ok
    from citizen_reports where reporter_id = p_user)
  select case
    when rp.category in ('senior_correspondent', 'editorial_contributor') then 'Senior Correspondent'
    when s.a >= 50 and s.a::numeric / greatest(s.a + s.r, 1) >= 0.85 and s.first_ok < now() - interval '90 days' then 'Trusted Correspondent'
    when rp.status in ('verified', 'active') and s.a >= 15 and s.a::numeric / greatest(s.a + s.r, 1) >= 0.7 then 'Verified Local Reporter'
    when s.a >= 5 and s.a::numeric / greatest(s.a + s.r, 1) >= 0.6 then 'Active Contributor'
    else 'New Contributor' end
  from reporter_profiles rp, s where rp.user_id = p_user
$$;

create or replace function award_badge(p_reporter uuid, p_badge text, p_period date, p_reason text, p_bonus_paise bigint default 0) returns badge_awards
language plpgsql security definer set search_path = public as $$
declare b badge_awards; e reporter_earnings;
begin
  if my_role() not in ('super_admin', 'editor') then raise exception 'Only editors and admins can award badges' using errcode = '42501'; end if;
  if coalesce(p_bonus_paise, 0) > 0 and not has_permission('finance') then raise exception 'A finance administrator must approve bonus payments'; end if;
  insert into badge_awards (reporter_id, badge_code, period, reason, bonus_paise, awarded_by)
  values (p_reporter, p_badge, date_trunc('month', coalesce(p_period, now()))::date, p_reason, coalesce(p_bonus_paise, 0), auth.uid()) returning * into b;
  if b.bonus_paise > 0 then
    e := credit_earning(p_reporter, 'bonus', b.bonus_paise, null, null, b.id, 'Bonus: ' || p_badge);
    update badge_awards set earning_id = e.id where id = b.id returning * into b;
  end if;
  perform notify(p_reporter, 'badge', 'You earned a badge: ' || (select name_en from contributor_badges where code = p_badge),
    'మీకు బ్యాడ్జ్: ' || (select name_te from contributor_badges where code = p_badge), p_reason, p_reason, '/reporter');
  perform audit('badge_awarded', 'badge_awards', b.id::text, jsonb_build_object('badge', p_badge, 'bonus_paise', b.bonus_paise));
  return b;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. DASHBOARD QUERIES
-- ════════════════════════════════════════════════════════════════════════════
create or replace function reporter_dashboard() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(rp) - 'reviewed_by' from reporter_profiles rp where rp.user_id = auth.uid()),
    'verified_identity', exists (select 1 from reporter_verifications where user_id = auth.uid() and status = 'approved'),
    'level', reporter_level(auth.uid()),
    'counts', (select jsonb_build_object(
        'total', count(*) filter (where status <> 'draft'),
        'drafts', count(*) filter (where status = 'draft'),
        'under_review', count(*) filter (where status in ('submitted', 'ai_processing', 'under_review', 'on_hold')),
        'correction_required', count(*) filter (where status = 'correction_required'),
        'approved', count(*) filter (where status in ('approved', 'published')),
        'rejected', count(*) filter (where status = 'rejected'))
      from citizen_reports where reporter_id = auth.uid()),
    'wallet', (select jsonb_build_object('available_paise', coalesce(available_paise, 0), 'reserved_paise', coalesce(reserved_paise, 0),
        'paid_paise', coalesce(paid_paise, 0), 'lifetime_earned_paise', coalesce(lifetime_earned_paise, 0))
      from (select 1) x left join wallet_accounts w on w.reporter_id = auth.uid()),
    'pending_earnings_paise', (select coalesce(sum(case
        when c.assignment_id is not null and a.special_amount_paise > 0 then a.special_amount_paise
        when c.submission_type = 'detailed_report' then (select min_paise from contribution_rates where code = 'detailed_report')
        when exists (select 1 from submission_media m where m.submission_id = c.id and m.kind = 'video') then (select min_paise from contribution_rates where code = 'original_video')
        when exists (select 1 from submission_media m where m.submission_id = c.id and m.kind = 'photo') then (select min_paise from contribution_rates where code = 'original_photo')
        else (select min_paise from contribution_rates where code = 'text_news') end), 0)
      from citizen_reports c left join reporter_assignments a on a.id = c.assignment_id
      where c.reporter_id = auth.uid() and c.status in ('submitted', 'ai_processing', 'under_review', 'on_hold')),
    'threshold_paise', setting_int('withdrawal_threshold_paise', 30000),
    'monthly', (select coalesce(jsonb_agg(m order by m->>'month'), '[]') from (
        select jsonb_build_object('month', to_char(date_trunc('month', approved_at), 'YYYY-MM'), 'earned_paise', sum(amount_paise), 'stories', count(*)) m
        from reporter_earnings where reporter_id = auth.uid() and status = 'credited' and approved_at > now() - interval '6 months'
        group by date_trunc('month', approved_at)) x),
    'badges', (select coalesce(jsonb_agg(jsonb_build_object('code', b.badge_code, 'name_en', cb.name_en, 'name_te', cb.name_te, 'period', b.period, 'icon', cb.icon) order by b.created_at desc), '[]')
      from badge_awards b join contributor_badges cb on cb.code = b.badge_code where b.reporter_id = auth.uid()),
    'rank', (select r from (select reporter_id, rank() over (order by score desc) r from reporter_scores()) x where reporter_id = auth.uid()),
    'unread', (select count(*) from notifications where user_id = auth.uid() and read_at is null)
  )
$$;

create or replace function leaderboard(p_month date default date_trunc('month', now())::date)
returns table (rank bigint, name text, district_id text, category text, approved int, accuracy numeric, score numeric)
language sql stable security definer set search_path = public as $$
  select rank() over (order by score desc), name, district_id, category, approved, accuracy, score from reporter_scores(p_month) where score > 0 limit 20
$$;

create or replace function finance_summary(p_from date default (now() - interval '30 days')::date, p_to date default now()::date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_permission('finance') then raise exception 'Finance permission required' using errcode = '42501'; end if;
  return jsonb_build_object(
    'accrued_paise', (select coalesce(sum(amount_paise), 0) from reporter_earnings where status = 'credited' and approved_at::date between p_from and p_to),
    'lifetime_accrued_paise', (select coalesce(sum(lifetime_earned_paise), 0) from wallet_accounts),
    'liability_available_paise', (select coalesce(sum(available_paise), 0) from wallet_accounts),
    'liability_reserved_paise', (select coalesce(sum(reserved_paise), 0) from wallet_accounts),
    'paid_paise', (select coalesce(sum(paid_paise), 0) from wallet_accounts),
    'withdrawals', (select jsonb_object_agg(status, jsonb_build_object('count', n, 'amount_paise', amt)) from
        (select status, count(*) n, sum(amount_paise) amt from withdrawal_requests group by status) x),
    'needs_reconciliation', (select count(*) from withdrawal_requests where needs_reconciliation),
    'monthly_paid', (select coalesce(jsonb_agg(x order by x->>'month'), '[]') from (
        select jsonb_build_object('month', to_char(date_trunc('month', paid_at), 'YYYY-MM'), 'paid_paise', sum(amount_paise), 'count', count(*)) x
        from withdrawal_requests where status = 'paid' and paid_at > now() - interval '12 months' group by date_trunc('month', paid_at)) y),
    'unverified_methods', (select count(*) from payout_methods where active and verification_status in ('unverified', 'pending'))
  );
end $$;

-- Ledger reconciliation: wallet balances must equal the sum of ledger postings.
create or replace function ledger_check() returns table (reporter_id uuid, field text, wallet bigint, ledger bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_permission('finance') and not is_service_caller() then raise exception 'Finance permission required' using errcode = '42501'; end if;
  return query
  with l as (select e.reporter_id, sum(available_delta)::bigint a, sum(reserved_delta)::bigint r, sum(paid_delta)::bigint p from wallet_ledger_entries e group by e.reporter_id)
  select w.reporter_id, f.field, f.wv, f.lv from wallet_accounts w left join l on l.reporter_id = w.reporter_id,
  lateral (values ('available', w.available_paise, coalesce(l.a, 0)), ('reserved', w.reserved_paise, coalesce(l.r, 0)), ('paid', w.paid_paise, coalesce(l.p, 0))) f(field, wv, lv)
  where f.wv <> f.lv;
end $$;

create or replace function reporter_network() returns table (district_id text, active int, pending int, suspended int, submissions_30d int, published_30d int)
language sql stable security definer set search_path = public as $$
  select d.id,
    (select count(*) from reporter_profiles where district_id = d.id and status in ('active', 'verified'))::int,
    (select count(*) from reporter_profiles where district_id = d.id and status in ('registered', 'verification_pending'))::int,
    (select count(*) from reporter_profiles where district_id = d.id and status = 'suspended')::int,
    (select count(*) from citizen_reports where district_id = d.id and submitted_at > now() - interval '30 days')::int,
    (select count(*) from citizen_reports where district_id = d.id and status = 'published' and published_at > now() - interval '30 days')::int
  from districts d where is_staff() order by d.name
$$;

-- Public story JSON now carries the contributor byline (no contact details).
create or replace function story_json(s stories) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', s.id, 'category', s.category_id, 'stateId', s.state_id, 'districtId', s.district_id,
    'mandalId', s.mandal_id, 'villageId', s.village_id,
    'lat', st_y(s.geo::geometry), 'lng', st_x(s.geo::geometry),
    'image', image_url(s.image_path), 'source', s.source, 'sourceUrl', s.source_url,
    'publishedAt', s.published_at, 'isBreaking', s.is_breaking,
    'isTrending', s.shares > 900, 'sponsor', s.sponsor,
    'reporter', (select jsonb_build_object('name', rp.name, 'verified', true, 'citizen', true, 'label', rp.category_label)
                 from reporter_public rp where rp.user_id = s.author_id and s.citizen_report_id is not null),
    'reactions', (select jsonb_build_object(
        'like', count(*) filter (where kind = 'like'), 'wow', count(*) filter (where kind = 'wow'),
        'sad', count(*) filter (where kind = 'sad'), 'angry', count(*) filter (where kind = 'angry'))
      from reactions r where r.story_id = s.id),
    'comments', s.comment_count, 'shares', s.shares, 'views', s.views,
    'content', (select jsonb_object_agg(t.lang, jsonb_build_object('headline', t.headline, 'summary', t.summary))
      from story_translations t where t.story_id = s.id)
  )
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 9. ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════════════════
do $$ declare t text; begin
  foreach t in array array['staff_permissions','audit_logs','notifications','reporter_profiles','reporter_areas','reporter_verifications',
    'submission_media','editorial_reviews','contribution_rates','reporter_earnings','wallet_accounts','wallet_ledger_entries',
    'reporter_assignments','payout_methods','payout_method_secrets','withdrawal_requests','payment_transactions','payment_webhook_events',
    'contributor_badges','badge_awards'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

drop policy if exists read_perm on staff_permissions;
create policy read_perm on staff_permissions for select using (user_id = auth.uid() or my_role() = 'super_admin');
drop policy if exists admin_perm on staff_permissions;
create policy admin_perm on staff_permissions for all using (my_role() = 'super_admin') with check (my_role() = 'super_admin');

drop policy if exists read_audit on audit_logs;
create policy read_audit on audit_logs for select using (my_role() = 'super_admin' or (has_permission('finance') and entity in ('withdrawal_requests', 'payout_methods', 'reporter_earnings', 'contribution_rates', 'app_settings')));

drop policy if exists own_notifications on notifications;
create policy own_notifications on notifications for select using (user_id = auth.uid());
drop policy if exists mark_read on notifications;
create policy mark_read on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reporter_read on reporter_profiles;
create policy reporter_read on reporter_profiles for select using (user_id = auth.uid() or my_role() in ('super_admin', 'editor', 'district_moderator') or has_permission('finance') or has_permission('reporter_admin'));
drop policy if exists reporter_self_update on reporter_profiles;
create policy reporter_self_update on reporter_profiles for update using (false);  -- changes go through register_reporter / review_reporter

drop policy if exists areas_read on reporter_areas;
create policy areas_read on reporter_areas for select using (user_id = auth.uid() or my_role() in ('super_admin', 'editor', 'district_moderator') or has_permission('reporter_admin'));

drop policy if exists verif_read on reporter_verifications;
create policy verif_read on reporter_verifications for select using (user_id = auth.uid() or my_role() in ('super_admin', 'editor') or has_permission('reporter_admin')
  or exists (select 1 from reporter_profiles rp where rp.user_id = reporter_verifications.user_id and moderates(rp.district_id)));

-- Submissions: reporters manage own drafts. Editors no longer update rows directly: every
-- editorial change goes through the audited editorial_* functions.
drop policy if exists moderate on citizen_reports;
drop policy if exists submit on citizen_reports;
drop policy if exists reporter_insert on citizen_reports;
create policy reporter_insert on citizen_reports for insert with check (reporter_id = auth.uid() and exists (select 1 from reporter_profiles where user_id = auth.uid() and status not in ('suspended', 'rejected'))
  or (reporter_id = auth.uid() and exists (select 1 from profiles where id = auth.uid() and verified_reporter)));
drop policy if exists reporter_update_own on citizen_reports;
create policy reporter_update_own on citizen_reports for update using (reporter_id = auth.uid() and status in ('draft', 'correction_required'))
  with check (reporter_id = auth.uid());
drop policy if exists reporter_delete_draft on citizen_reports;
create policy reporter_delete_draft on citizen_reports for delete using (reporter_id = auth.uid() and status = 'draft');

drop policy if exists media_read on submission_media;
create policy media_read on submission_media for select using (exists (select 1 from citizen_reports c where c.id = submission_id and (c.reporter_id = auth.uid() or moderates(c.district_id))));
drop policy if exists media_write on submission_media;
create policy media_write on submission_media for insert with check (exists (select 1 from citizen_reports c where c.id = submission_id and c.reporter_id = auth.uid() and c.status in ('draft', 'correction_required'))
  and split_part(storage_path, '/', 1) = auth.uid()::text);
drop policy if exists media_delete on submission_media;
create policy media_delete on submission_media for delete using (exists (select 1 from citizen_reports c where c.id = submission_id and c.reporter_id = auth.uid() and c.status in ('draft', 'correction_required')));

drop policy if exists reviews_read on editorial_reviews;
-- Reporters see the decisions on their own work, never editors' internal verification notes,
-- automated sensitivity flags or edit diffs; editors in the district see everything.
create policy reviews_read on editorial_reviews for select using (exists (select 1 from citizen_reports c where c.id = submission_id and (moderates(c.district_id)
  or (c.reporter_id = auth.uid() and action in ('submitted', 'queued_for_review', 'request_correction', 'hold', 'reject', 'reopen', 'approve', 'publish')))));

drop policy if exists rates_read on contribution_rates;
create policy rates_read on contribution_rates for select using (true);

drop policy if exists earnings_read on reporter_earnings;
create policy earnings_read on reporter_earnings for select using (reporter_id = auth.uid() or has_permission('finance'));
drop policy if exists wallet_read on wallet_accounts;
create policy wallet_read on wallet_accounts for select using (reporter_id = auth.uid() or has_permission('finance'));
drop policy if exists ledger_read on wallet_ledger_entries;
create policy ledger_read on wallet_ledger_entries for select using (reporter_id = auth.uid() or has_permission('finance'));

drop policy if exists assignments_read on reporter_assignments;
create policy assignments_read on reporter_assignments for select using (
  moderates(district_id) or assigned_reporter_id = auth.uid()
  or (status = 'open' and assigned_reporter_id is null and exists (select 1 from reporter_areas ra where ra.user_id = auth.uid() and ra.district_id = reporter_assignments.district_id)));
drop policy if exists assignments_write on reporter_assignments;
create policy assignments_write on reporter_assignments for all using (moderates(district_id)) with check (moderates(district_id));

drop policy if exists methods_read on payout_methods;
create policy methods_read on payout_methods for select using (reporter_id = auth.uid() or has_permission('finance'));
-- (no insert/update policies: methods are added by the payout-methods Edge Function, verified via RPC)

drop policy if exists wd_read on withdrawal_requests;
create policy wd_read on withdrawal_requests for select using (reporter_id = auth.uid() or has_permission('finance'));
drop policy if exists txn_read on payment_transactions;
create policy txn_read on payment_transactions for select using (has_permission('finance') or exists (select 1 from withdrawal_requests w where w.id = withdrawal_id and w.reporter_id = auth.uid()));
drop policy if exists wh_read on payment_webhook_events;
create policy wh_read on payment_webhook_events for select using (has_permission('finance'));

drop policy if exists badges_read on contributor_badges;
create policy badges_read on contributor_badges for select using (true);
drop policy if exists badges_admin on contributor_badges;
create policy badges_admin on contributor_badges for all using (my_role() = 'super_admin') with check (my_role() = 'super_admin');
drop policy if exists awards_read on badge_awards;
create policy awards_read on badge_awards for select using (true);

-- Finance-only staff can sign in to the CMS; let them read reporter names on payout screens.
drop policy if exists finance_profiles on profiles;
create policy finance_profiles on profiles for select using (has_permission('finance'));

-- Internal functions must not be callable from the API.
do $$ declare f text; begin
  foreach f in array array['ledger_post(uuid,text,bigint,bigint,bigint,text,uuid,uuid,uuid,text)',
    'credit_earning(uuid,text,bigint,uuid,uuid,uuid,text)', 'notify(uuid,text,text,text,text,text,text,jsonb)', 'notify_finance(text,text,text,text)',
    'audit(text,text,text,jsonb)', 'log_review(uuid,text,text,text,text,jsonb,boolean)',
    'mark_withdrawal_processing(uuid,uuid,uuid)', 'apply_payout_status(uuid,text,text,text,bigint,bigint,jsonb,text)'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke execute on function %s from anon', f); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke execute on function %s from authenticated', f); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 10. STORAGE: private buckets for submission media and ID documents
-- ════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public) values ('submissions', 'submissions', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('reporter-private', 'reporter-private', false) on conflict (id) do nothing;
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
    update storage.buckets set file_size_limit = 104857600,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime','video/webm','audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav','application/pdf']
      where id = 'submissions';
    update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'] where id = 'reporter-private';
  end if;
end $$;

drop policy if exists "reporter uploads submission media" on storage.objects;
create policy "reporter uploads submission media" on storage.objects for insert with check (
  bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text
  and (exists (select 1 from public.reporter_profiles where user_id = auth.uid() and status not in ('suspended', 'rejected'))
       or exists (select 1 from public.profiles p where p.id = auth.uid() and p.verified_reporter
                  and not exists (select 1 from public.reporter_profiles r where r.user_id = auth.uid()))));
drop policy if exists "read submission media" on storage.objects;
create policy "read submission media" on storage.objects for select using (
  bucket_id = 'submissions' and ((storage.foldername(name))[1] = auth.uid()::text or public.my_role() in ('super_admin', 'editor', 'district_moderator')));
drop policy if exists "reporter deletes own draft media" on storage.objects;
create policy "reporter deletes own draft media" on storage.objects for delete using (bucket_id = 'submissions' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "reporter uploads id document" on storage.objects;
create policy "reporter uploads id document" on storage.objects for insert with check (bucket_id = 'reporter-private' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "read id documents" on storage.objects;
create policy "read id documents" on storage.objects for select using (bucket_id = 'reporter-private' and ((storage.foldername(name))[1] = auth.uid()::text
  or public.my_role() in ('super_admin', 'editor') or public.has_permission('reporter_admin')));
drop policy if exists "reporter uploads avatar" on storage.objects;
create policy "reporter uploads avatar" on storage.objects for insert with check (bucket_id = 'media' and (storage.foldername(name))[1] = 'avatars' and (storage.foldername(name))[2] = auth.uid()::text);
