-- API: RPC functions + views consumed by the app and CMS ────────
-- Image CDN base. Set per environment:  alter database postgres set app.image_cdn = 'https://img.vaarta.app';
-- The CDN (Cloudflare Images / imgproxy / Supabase image transforms) serves auto-WebP/AVIF at the requested width.
create or replace function image_url(path text, w int default 900) returns text language sql immutable as $$
  select case when path ~ '^https?://' then path
    else coalesce(nullif(current_setting('app.image_cdn', true), ''), '/storage/v1/render/image/public/media') || '/' || path || '?width=' || w || '&format=webp&quality=78' end
$$;

-- Create a profile row on first OTP sign-in
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, phone) values (new.id, new.phone) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- Story → JSON in the exact shape of app/src/data/types.ts `Story`
create or replace function story_json(s stories) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', s.id, 'category', s.category_id, 'stateId', s.state_id, 'districtId', s.district_id,
    'mandalId', s.mandal_id, 'villageId', s.village_id,
    'lat', st_y(s.geo::geometry), 'lng', st_x(s.geo::geometry),
    'image', image_url(s.image_path), 'source', s.source, 'sourceUrl', s.source_url,
    'publishedAt', s.published_at, 'isBreaking', s.is_breaking,
    'isTrending', s.shares > 900, 'sponsor', s.sponsor,
    'reactions', (select jsonb_build_object(
        'like', count(*) filter (where kind = 'like'), 'wow', count(*) filter (where kind = 'wow'),
        'sad', count(*) filter (where kind = 'sad'), 'angry', count(*) filter (where kind = 'angry'))
      from reactions r where r.story_id = s.id),
    'comments', s.comment_count, 'shares', s.shares, 'views', s.views,
    'content', (select jsonb_object_agg(t.lang, jsonb_build_object('headline', t.headline, 'summary', t.summary))
      from story_translations t where t.story_id = s.id)
  )
$$;

-- Hyperlocal feed: locality first, then recency; client re-ranks with on-device signals (lib/personalize.ts)
create or replace function get_feed(p_lang text, p_district text, p_mandal text default null, p_limit int default 100, p_before timestamptz default null)
returns jsonb language sql stable as $$
  with d as (select state_id from districts where id = p_district),
  ranked as (
    select s.id,
      (case when s.is_breaking then 3 else 0 end)
      + (case when s.mandal_id = p_mandal then 2.4 when s.district_id = p_district then 1.8 when s.state_id = (select state_id from d) then 0.6 else 0 end)
      + ln(1 + s.shares * 3 + s.comment_count * 2) * 0.22
      - ln(1 + extract(epoch from now() - s.published_at) / 3600) * 0.8 as score
    from stories s
    where s.status = 'published' and s.published_at <= now()
      and (p_before is null or s.published_at < p_before)
      and s.published_at > now() - interval '7 days'
      and exists (select 1 from story_translations t where t.story_id = s.id and t.lang in (p_lang, 'en'))
    order by score desc
    limit p_limit
  )
  select coalesce(jsonb_agg(story_json(s) order by r.score desc), '[]'::jsonb)
  from ranked r join stories s on s.id = r.id
$$;

-- Polls with results per scope: { national: {opt: n}, <district>: {opt: n} }
create or replace function get_polls_with_results() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'category', p.category_id, 'closesAt', p.closes_at,
    'question', (select jsonb_object_agg(lang, question) from poll_questions q where q.poll_id = p.id),
    'options', (select jsonb_agg(jsonb_build_object('id', o.id,
        'label', (select jsonb_object_agg(lang, label) from poll_option_labels l where l.poll_id = p.id and l.option_id = o.id)) order by o.sort)
      from poll_options o where o.poll_id = p.id),
    'votes', (
      select jsonb_build_object('national', coalesce((select jsonb_object_agg(option_id, n) from (select option_id, count(*) n from votes v where v.poll_id = p.id group by 1) x), '{}'))
        || coalesce((select jsonb_object_agg(district_id, opts) from (
             select district_id, jsonb_object_agg(option_id, n) opts from (
               select district_id, option_id, count(*) n from votes v where v.poll_id = p.id and district_id is not null group by 1, 2) y group by 1) z), '{}')
    )
  )), '[]'::jsonb) from polls p where p.closes_at > now() - interval '1 day'
$$;

create or replace function cast_vote(p_poll text, p_option text, p_district text) returns void language sql security definer set search_path = public as $$
  insert into votes (poll_id, user_id, option_id, district_id)
  select p_poll, auth.uid(), p_option, p_district
  where auth.uid() is not null and exists (select 1 from polls where id = p_poll and closes_at > now())
  on conflict (poll_id, user_id) do nothing
$$;

-- Lightweight engagement logging (batched from the client)
create or replace function log_events(p_events jsonb) returns void language sql security definer set search_path = public as $$
  insert into read_events (user_id, device_id, story_id, district_id, dwell_ms, action)
  select auth.uid(), e->>'deviceId', e->>'storyId', e->>'districtId', (e->>'dwellMs')::int, e->>'action'
  from jsonb_array_elements(p_events) e;
  update stories s set views = views + x.v, flips = flips + x.f, shares = shares + x.sh
  from (select e->>'storyId' id, count(*) filter (where e->>'action' = 'view') v, count(*) filter (where e->>'action' = 'flip') f,
               count(*) filter (where e->>'action' = 'share') sh from jsonb_array_elements(p_events) e group by 1) x
  where s.id = x.id;
$$;

-- Postgres fallback search (production uses Meilisearch synced via backend/search/sync.ts)
create or replace function search_stories(q text, p_district text default null, p_category text default null, p_since interval default null, p_lang text default null)
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(story_json(s) order by s.published_at desc), '[]') from stories s
  where s.status = 'published'
    and (p_district is null or s.district_id = p_district)
    and (p_category is null or s.category_id = p_category)
    and (p_since is null or s.published_at > now() - p_since)
    and exists (select 1 from story_translations t where t.story_id = s.id
                and (p_lang is null or t.lang = p_lang)
                and (q is null or q = '' or (t.headline || ' ' || t.summary) ilike '%' || q || '%'))
  limit 50
$$;

create or replace view video_feed with (security_invoker = true) as
  select id, story_id as "storyId", image_url(video_path) as uri, image_url(poster_path) as poster, district_id as "districtId",
         category_id as category, duration_sec as "durationSec", caption, subtitles, likes, shares
  from videos order by published_at desc;

-- Moderation: approve a citizen report → creates a published story with translation
create or replace function approve_report(p_report uuid, p_headline text, p_summary text, p_image_path text, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare r citizen_reports; sid text;
begin
  select * into r from citizen_reports where id = p_report for update;
  if not moderates(r.district_id) then raise exception 'not allowed'; end if;
  insert into stories (category_id, state_id, district_id, mandal_id, image_path, source, status, published_at, citizen_report_id, author_id, geo)
  select r.category_id, d.state_id, r.district_id, r.mandal_id, coalesce(p_image_path, r.media[1]), 'Citizen Reporter', 'published', now(), r.id, r.reporter_id,
         (select geo from mandals where id = r.mandal_id)
  from districts d where d.id = r.district_id returning id into sid;
  insert into story_translations (story_id, lang, headline, summary) values (sid, r.lang, p_headline, p_summary);
  update citizen_reports set status = 'approved', reviewer_id = auth.uid(), reviewed_at = now(), review_note = p_note, story_id = sid where id = p_report;
  return sid;
end $$;

-- Analytics views for the CMS
create or replace view analytics_daily with (security_invoker = true) as
  select date_trunc('day', created_at)::date as day, district_id,
    count(*) filter (where action = 'view') views, count(*) filter (where action = 'flip') flips,
    count(*) filter (where action = 'share') shares, count(distinct coalesce(user_id::text, device_id)) readers
  from read_events group by 1, 2;

create or replace view analytics_category with (security_invoker = true) as
  select s.category_id, e.district_id, count(*) filter (where action = 'view') views,
    avg(dwell_ms) filter (where action = 'view') avg_dwell_ms, count(*) filter (where action = 'share') shares
  from read_events e join stories s on s.id = e.story_id
  where e.created_at > now() - interval '30 days' group by 1, 2;

-- D1 / D7 retention cohort by district
create or replace view analytics_retention with (security_invoker = true) as
  with first_seen as (select coalesce(user_id::text, device_id) uid, min(created_at)::date d0, min(district_id) district_id from read_events group by 1)
  select f.district_id, f.d0,
    count(*) cohort,
    count(*) filter (where exists (select 1 from read_events e where coalesce(e.user_id::text, e.device_id) = f.uid and e.created_at::date = f.d0 + 1)) d1,
    count(*) filter (where exists (select 1 from read_events e where coalesce(e.user_id::text, e.device_id) = f.uid and e.created_at::date = f.d0 + 7)) d7
  from first_seen f group by 1, 2;

-- Scheduled publishing: run every minute with pg_cron
--   select cron.schedule('publish-scheduled', '* * * * *', $$select publish_due()$$);
create or replace function publish_due() returns int language sql as $$
  with up as (update stories set status = 'published', published_at = publish_at
              where status = 'scheduled' and publish_at <= now() returning 1)
  select count(*)::int from up
$$;
