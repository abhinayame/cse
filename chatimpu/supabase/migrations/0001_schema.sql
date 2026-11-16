-- Chatimpu core schema ─────────────────────────────────────────────
create extension if not exists pg_trgm;
create extension if not exists postgis;

create type role_kind as enum ('super_admin', 'editor', 'district_moderator', 'reporter', 'reader');
create type story_status as enum ('draft', 'scheduled', 'published', 'archived');
create type report_status as enum ('pending', 'approved', 'rejected');
create type reaction_kind as enum ('like', 'wow', 'sad', 'angry');
create type alert_kind as enum ('power', 'water', 'traffic', 'weather', 'jobs', 'events');
create type alert_severity as enum ('info', 'warning', 'critical');
create type ad_status as enum ('active', 'paused', 'ended');

-- ── Reference data ──────────────────────────────────────────────
create table languages (code text primary key, native text not null, english text not null);

create table categories (id text primary key, sort int not null default 0, icon text);
create table category_names (category_id text references categories on delete cascade, lang text references languages, name text not null, primary key (category_id, lang));

create table states    (id text primary key, name text not null, name_te text);
create table districts (id text primary key, state_id text not null references states, name text not null, name_te text, geo geography(point));
create table mandals   (id text primary key, district_id text not null references districts, name text not null, name_te text, geo geography(point));
create table villages  (id text primary key, mandal_id text not null references mandals, name text not null, name_te text);
create index on districts (state_id);
create index on mandals (district_id);
create index on villages (mandal_id);

-- ── Users ───────────────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  phone text unique,
  display_name text,
  role role_kind not null default 'reader',
  verified_reporter boolean not null default false,
  language text references languages default 'te',
  state_id text references states,
  district_id text references districts,
  mandal_id text references mandals,
  village_id text references villages,
  interests text[] not null default '{}',
  premium_until timestamptz,
  created_at timestamptz not null default now()
);
-- Districts a moderator is responsible for
create table moderator_districts (user_id uuid references profiles on delete cascade, district_id text references districts, primary key (user_id, district_id));

-- ── Stories ─────────────────────────────────────────────────────
create table stories (
  id text primary key default gen_random_uuid()::text,
  category_id text not null references categories,
  state_id text not null references states,
  district_id text not null references districts,
  mandal_id text references mandals,
  village_id text references villages,
  geo geography(point),
  image_path text not null,                 -- storage path; served through the image CDN
  source text not null,
  source_url text,
  status story_status not null default 'draft',
  publish_at timestamptz,
  published_at timestamptz,
  is_breaking boolean not null default false,
  push_on_publish boolean not null default false,
  sponsor text,                             -- non-null ⇒ always rendered with a "Sponsored" label
  author_id uuid references profiles,
  citizen_report_id uuid,
  views int not null default 0,
  flips int not null default 0,
  shares int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stories_feed_idx on stories (district_id, status, published_at desc);
create index stories_cat_idx on stories (category_id, published_at desc);
create index stories_geo_idx on stories using gist (geo);

create table story_translations (
  story_id text references stories on delete cascade,
  lang text references languages,
  headline text not null,
  summary text not null check (array_length(regexp_split_to_array(trim(summary), '\s+'), 1) between 30 and 100),
  machine_translated boolean not null default false,
  primary key (story_id, lang)
);
create index story_tr_search_idx on story_translations using gin ((headline || ' ' || summary) gin_trgm_ops);

create table story_tags (story_id text references stories on delete cascade, tag text, primary key (story_id, tag));

-- ── Engagement ──────────────────────────────────────────────────
create table bookmarks (user_id uuid references profiles on delete cascade, story_id text references stories on delete cascade, created_at timestamptz default now(), primary key (user_id, story_id));
create table reactions (user_id uuid references profiles on delete cascade, story_id text references stories on delete cascade, kind reaction_kind not null, primary key (user_id, story_id));
create table comments (
  id uuid primary key default gen_random_uuid(),
  story_id text references stories on delete cascade,
  user_id uuid references profiles on delete cascade,
  body text not null check (length(body) between 1 and 1000),
  hidden boolean not null default false,
  created_at timestamptz default now()
);
create index on comments (story_id, created_at desc);

-- Implicit signals used for personalisation + analytics (partition by month in production)
create table read_events (
  id bigint generated always as identity primary key,
  user_id uuid,
  device_id text,
  story_id text references stories on delete cascade,
  district_id text,
  dwell_ms int,
  action text not null check (action in ('view', 'flip', 'skip', 'share', 'listen', 'bookmark')),
  created_at timestamptz not null default now()
);
create index on read_events (created_at);
create index on read_events (story_id);

-- ── Polls ───────────────────────────────────────────────────────
create table polls (id text primary key, category_id text references categories, district_id text references districts, closes_at timestamptz not null, created_at timestamptz default now());
create table poll_questions (poll_id text references polls on delete cascade, lang text references languages, question text not null, primary key (poll_id, lang));
create table poll_options (id text, poll_id text references polls on delete cascade, sort int default 0, primary key (poll_id, id));
create table poll_option_labels (poll_id text, option_id text, lang text references languages, label text not null, primary key (poll_id, option_id, lang), foreign key (poll_id, option_id) references poll_options);
create table votes (
  poll_id text references polls on delete cascade,
  user_id uuid references profiles on delete cascade,
  option_id text not null,
  district_id text references districts,
  created_at timestamptz default now(),
  primary key (poll_id, user_id),
  foreign key (poll_id, option_id) references poll_options
);
create index on votes (poll_id, district_id);

-- ── Magazines ───────────────────────────────────────────────────
create table magazines (id text primary key, theme text not null, cover_path text not null, title jsonb not null, subtitle jsonb not null, published boolean default true);
create table magazine_stories (magazine_id text references magazines on delete cascade, story_id text references stories on delete cascade, sort int, primary key (magazine_id, story_id));

-- ── Local alerts ────────────────────────────────────────────────
create table local_alerts (
  id text primary key default gen_random_uuid()::text,
  kind alert_kind not null,
  severity alert_severity not null default 'info',
  district_id text not null references districts,
  mandal_id text references mandals,
  geo geography(point),
  title jsonb not null,   -- { "en": "...", "te": "..." }
  detail jsonb not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references profiles
);
create index on local_alerts (district_id, starts_at);

-- ── Citizen reporter ────────────────────────────────────────────
create table citizen_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles default auth.uid(),
  headline text not null,
  body text not null,
  lang text references languages not null,
  category_id text references categories not null,
  district_id text references districts not null,
  mandal_id text references mandals,
  media text[] not null default '{}',
  status report_status not null default 'pending',
  ai_flags text[] not null default '{}',
  reviewer_id uuid references profiles,
  review_note text,
  story_id text references stories,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index on citizen_reports (status, district_id, submitted_at);
alter table stories add constraint stories_citizen_fk foreign key (citizen_report_id) references citizen_reports;

-- ── Ads ─────────────────────────────────────────────────────────
create table advertisers (id uuid primary key default gen_random_uuid(), name text not null, phone text, district_id text references districts, business_listing boolean default false);
create table ads (
  id text primary key default gen_random_uuid()::text,
  advertiser_id uuid references advertisers,
  district_ids text[],                 -- null ⇒ all districts
  image_path text not null,
  headline jsonb not null, body jsonb not null, cta jsonb not null,
  url text not null,
  status ad_status not null default 'paused',
  budget_inr int not null default 0,
  cpm_inr numeric(8,2) not null default 120,
  starts_at timestamptz default now(), ends_at timestamptz,
  impressions int not null default 0, clicks int not null default 0
);

-- ── Videos ──────────────────────────────────────────────────────
create table videos (
  id text primary key default gen_random_uuid()::text,
  story_id text references stories,
  video_path text not null, poster_path text not null,
  district_id text references districts, category_id text references categories,
  duration_sec int not null,
  caption jsonb not null, subtitles jsonb not null default '[]',
  likes int default 0, shares int default 0,
  published_at timestamptz default now()
);

-- ── Push ────────────────────────────────────────────────────────
create table push_tokens (
  token text primary key,
  user_id uuid references profiles on delete cascade default auth.uid(),
  platform text,
  district_id text references districts,
  mandal_id text references mandals,
  language text,
  interests text[] default '{}',
  prefs jsonb default '{"breaking":true,"local":true,"digest":true,"interests":true}',
  updated_at timestamptz default now()
);
create index on push_tokens (district_id);

-- updated_at trigger
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger stories_touch before update on stories for each row execute function touch_updated_at();
