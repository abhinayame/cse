-- ════════════════════════════════════════════════════════════════════════════
-- 0008 · Newsroom content: duplicate auto-reject, News Reels, daily WhatsApp status, automated intake
-- Safe to run more than once.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Settings ─────────────────────────────────────────────────────────────────
insert into app_settings (key, value) values
  ('duplicate_auto_reject', 'true'),         -- reject the LATER of two matching reports from different reporters
  ('duplicate_match_percent', '40'),         -- 0–100: similarity needed to count as the same incident (same incident ≈ 45–55, different ≈ 15–25)
  ('duplicate_window_hours', '48')           -- only reports submitted this close together are compared
on conflict (key) do nothing;

-- Newsroom keys may be changed by editors; finance keys stay finance-only (0007); super admins any key.
create or replace function set_setting(p_key text, p_value jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (my_role() = 'super_admin'
          or (has_permission('finance') and p_key in ('withdrawal_threshold_paise', 'max_open_withdrawals', 'payouts_live_enabled',
                                                        'tds_enabled', 'tds_rate_bps', 'tds_rate_no_pan_bps', 'tds_threshold_paise', 'tds_section'))
          or (my_role() = 'editor' and p_key in ('duplicate_auto_reject', 'duplicate_match_percent', 'duplicate_window_hours',
                                                  'intake_enabled', 'intake_max_per_run', 'intake_daily_target'))) then
    raise exception 'You do not have permission to change %', p_key using errcode = '42501';
  end if;
  if p_key = 'withdrawal_threshold_paise' and ((p_value #>> '{}')::bigint < 100 or (p_value #>> '{}')::bigint > 10000000) then
    raise exception 'Threshold must be between ₹1 and ₹1,00,000';
  end if;
  if p_key in ('tds_rate_bps', 'tds_rate_no_pan_bps') and ((p_value #>> '{}')::int < 0 or (p_value #>> '{}')::int > 3000) then
    raise exception 'TDS rate must be between 0%% and 30%%';
  end if;
  if p_key = 'tds_threshold_paise' and (p_value #>> '{}')::bigint < 0 then raise exception 'Threshold cannot be negative'; end if;
  if p_key = 'duplicate_match_percent' and ((p_value #>> '{}')::int < 30 or (p_value #>> '{}')::int > 95) then
    raise exception 'Match level must be between 30%% and 95%%';
  end if;
  if p_key = 'duplicate_window_hours' and ((p_value #>> '{}')::int < 1 or (p_value #>> '{}')::int > 168) then
    raise exception 'Window must be between 1 and 168 hours';
  end if;
  insert into app_settings (key, value, updated_at) values (p_key, p_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  perform audit('setting_changed', 'app_settings', p_key, jsonb_build_object('value', p_value));
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. DUPLICATE REPORTS: the earlier report is kept, the later one is auto-rejected
-- ════════════════════════════════════════════════════════════════════════════
alter table citizen_reports add column if not exists duplicate_of uuid references citizen_reports;
alter table citizen_reports add column if not exists duplicate_score numeric;

-- Significant words of a report (Telugu or English). Telugu vowel signs are not punctuation, so words
-- stay whole; very common words are dropped so they do not make unrelated reports look alike.
create or replace function report_keywords(t text) returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct w), '{}') from regexp_split_to_table(lower(coalesce(t, '')), '[\s[:punct:]“”‘’–—|]+') w
  where char_length(w) >= 3 and w !~ '^\d{1,2}$' and w not in (
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'has', 'have', 'had', 'its', 'into', 'over', 'after', 'near',
    'said', 'says', 'will', 'been', 'their', 'they', 'which', 'when', 'where', 'about', 'more', 'than', 'also', 'today', 'yesterday',
    'ఈ', 'ఆ', 'మరియు', 'కూడా', 'ఒక', 'లో', 'నుంచి', 'చేశారు', 'చేసింది', 'ఉంది', 'ఉన్నారు', 'అని', 'వరకు', 'కోసం', 'తెలిపారు', 'ఇది', 'అది', 'ఆయన', 'ఆమె')
$$;

/** 0–1 similarity of two reports: headline wording (trigrams) blended with shared keywords. */
create or replace function report_match_score(h1 text, b1 text, h2 text, b2 text) returns numeric language sql immutable as $$
  with k as (select report_keywords(h1 || ' ' || left(coalesce(b1, ''), 600)) a, report_keywords(h2 || ' ' || left(coalesce(b2, ''), 600)) b),
  -- a word counts as shared when the other report has the same word or a close variant
  -- (Telugu case endings: అమీర్‌పేటలో ≈ అమీర్‌పేట; English plurals / tenses)
  o as (select (select count(*) from unnest(a) x where exists (select 1 from unnest(b) y where y = x or similarity(x, y) >= 0.45))::numeric as shared,
               least(cardinality(a), cardinality(b))::numeric as smaller from k)
  select round(greatest(
    similarity(lower(h1), lower(h2)),                                                       -- near-identical headlines
    0.5 * similarity(lower(h1), lower(h2)) + 0.5 * case when smaller > 0 then shared / smaller else 0 end
  )::numeric, 2) from o
$$;

-- BEFORE trigger, after citizen_reports_before_trg (triggers fire in name order): runs on the transition
-- into the review queue, so the later report never reaches editors and never earns.
create or replace function auto_reject_duplicate() returns trigger language plpgsql security definer set search_path = public as $$
declare e record; thr numeric := setting_int('duplicate_match_percent', 40) / 100.0;
begin
  if new.status = 'under_review' and (tg_op = 'INSERT' or old.status in ('draft', 'correction_required', 'submitted'))
     and setting_bool('duplicate_auto_reject') then
    select c.id, c.code, c.submitted_at, report_match_score(c.headline, c.body, new.headline, new.body) score into e
    from citizen_reports c
    where c.id <> new.id and c.reporter_id <> new.reporter_id and c.district_id = new.district_id
      and c.status not in ('draft', 'rejected', 'correction_required')
      and c.submitted_at < new.submitted_at
      and c.submitted_at > new.submitted_at - make_interval(hours => setting_int('duplicate_window_hours', 48)::int)
      and similarity(lower(c.headline), lower(new.headline)) > 0.1                 -- cheap pre-filter (pg_trgm index)
    order by report_match_score(c.headline, c.body, new.headline, new.body) desc, c.submitted_at asc
    limit 1;
    if e.id is not null and e.score >= thr then
      new.status := 'rejected';
      new.duplicate_of := e.id;
      new.duplicate_score := e.score;
      new.reviewed_at := now();
      new.rejection_reason := 'Duplicate: the same incident was already reported earlier (' || e.code || ', ' || round(e.score * 100) || '% match). '
        || 'The earlier report is the one considered. If yours adds new facts, ask an editor to review it.';
      new.ai_flags := array(select distinct x from unnest(new.ai_flags || array['auto_rejected_duplicate']) x);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists citizen_reports_dup_trg on citizen_reports;
create trigger citizen_reports_dup_trg before insert or update on citizen_reports for each row execute function auto_reject_duplicate();

-- AFTER: audit trail + tell the reporter (the main after-trigger only handles the review queue).
create or replace function auto_reject_duplicate_after() returns trigger language plpgsql security definer set search_path = public as $$
declare orig citizen_reports;
begin
  if new.status = 'rejected' and new.duplicate_of is not null and (tg_op = 'INSERT' or old.status is distinct from 'rejected') then
    select * into orig from citizen_reports where id = new.duplicate_of;
    perform log_review(new.id, 'submitted', case when tg_op = 'INSERT' then null else old.status end, 'submitted', null, '{}', false);
    perform log_review(new.id, 'reject', 'submitted', 'rejected', new.rejection_reason,
      jsonb_build_object('auto', true, 'duplicate_of', orig.code, 'score', new.duplicate_score), true);
    perform notify(new.reporter_id, 'rejected', 'Already reported · ' || coalesce(new.code, ''), 'ఇప్పటికే వచ్చిన వార్త · ' || coalesce(new.code, ''),
      'Another contributor reported this incident first (' || orig.code || ').', 'ఈ సంఘటనను మరో కంట్రిబ్యూటర్ ముందే పంపారు (' || orig.code || ').', '/reporter/submissions/' || new.id);
  end if;
  return null;
end $$;
drop trigger if exists citizen_reports_dup_after_trg on citizen_reports;
create trigger citizen_reports_dup_after_trg after insert or update of status on citizen_reports for each row execute function auto_reject_duplicate_after();

-- Editors can overturn an auto-rejection (e.g. two different accidents on the same road).
create or replace function reinstate_duplicate(p_id uuid, p_note text) returns citizen_reports language plpgsql security definer set search_path = public as $$
declare c citizen_reports;
begin
  select * into c from citizen_reports where id = p_id for update;
  if c.id is null then raise exception 'Submission not found'; end if;
  perform require_editor(c.district_id);
  if c.status <> 'rejected' or c.duplicate_of is null then raise exception 'Only auto-rejected duplicates can be reinstated here'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Say why this is a different incident'; end if;
  update citizen_reports set status = 'under_review', rejection_reason = null, duplicate_of = null, reviewed_at = now(), reviewer_id = auth.uid(),
    ai_flags = array_remove(ai_flags, 'auto_rejected_duplicate') where id = p_id returning * into c;
  perform log_review(p_id, 'reopen', 'rejected', 'under_review', 'Not a duplicate: ' || p_note);
  perform notify(c.reporter_id, 'review', 'Your story is back in review · ' || c.code, 'మీ వార్త మళ్ళీ పరిశీలనలో ఉంది · ' || c.code, p_note, p_note, '/reporter/submissions/' || c.id);
  return c;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. NEWS REELS: vertical presenter videos with a two-line headline strip, series / episodes
-- ════════════════════════════════════════════════════════════════════════════
alter table videos add column if not exists headline_top jsonb not null default '{}';    -- white strip, e.g. {"te": "రేపటి నుంచే"}
alter table videos add column if not exists headline jsonb not null default '{}';        -- red strip,   e.g. {"te": "కొత్త రిజిస్ట్రేషన్ ఛార్జీలు!"}
alter table videos add column if not exists series text;                                  -- e.g. "Explainers"
alter table videos add column if not exists episode int check (episode is null or episode > 0);
alter table videos add column if not exists episode_total int check (episode_total is null or episode_total > 0);
alter table videos add column if not exists status text not null default 'published' check (status in ('draft', 'published'));
alter table videos add column if not exists created_by uuid references profiles default auth.uid();
create index if not exists videos_feed_idx on videos (status, published_at desc);

drop policy if exists read_all on videos;
create policy read_all on videos for select using (status = 'published' or my_role() in ('super_admin', 'editor', 'district_moderator'));
drop policy if exists staff_write on videos;
create policy staff_write on videos for all using (my_role() in ('super_admin', 'editor') or (my_role() = 'district_moderator' and moderates(district_id)))
  with check (my_role() in ('super_admin', 'editor') or (my_role() = 'district_moderator' and moderates(district_id)));

create or replace view video_feed with (security_invoker = true) as
  select id, story_id as "storyId", image_url(video_path) as uri, image_url(poster_path) as poster, district_id as "districtId",
         category_id as category, duration_sec as "durationSec", caption, subtitles, likes, shares,
         headline_top as "headlineTop", headline, series, episode, episode_total as "episodeTotal", published_at as "publishedAt"
  from videos where status = 'published' and published_at <= now() order by published_at desc;

-- Share / like counters from the app (anyone; one increment per call, clamped).
create or replace function bump_video(p_id text, p_kind text) returns void language sql security definer set search_path = public as $$
  update videos set shares = shares + case when p_kind = 'share' then 1 else 0 end, likes = likes + case when p_kind = 'like' then 1 else 0 end
  where id = p_id and status = 'published' and p_kind in ('share', 'like')
$$;
grant execute on function bump_video(text, text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. DAILY WHATSAPP STATUS: shareable 9:16 cards (quotes, greetings, devotional, proverbs, memes)
-- ════════════════════════════════════════════════════════════════════════════
create table if not exists status_cards (
  id text primary key default gen_random_uuid()::text,
  kind text not null check (kind in ('good_morning', 'good_night', 'quote', 'proverb', 'devotional', 'motivation', 'festival', 'meme')),
  lang text not null default 'te' references languages,
  text text not null check (char_length(text) between 1 and 400),
  attribution text,                                   -- e.g. "తెలుగు సామెత" or the author, when quoting
  background text not null default 'saffron',         -- gradient preset (app/src/data/status.ts) …
  image_path text,                                    -- … or an image in the media bucket (memes, festival art)
  publish_on date not null default ((now() at time zone 'Asia/Kolkata')::date),
  status text not null default 'published' check (status in ('draft', 'published')),
  shares int not null default 0,
  created_by uuid references profiles default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists status_cards_day_idx on status_cards (publish_on desc, status);
alter table status_cards enable row level security;
drop policy if exists status_read on status_cards;
create policy status_read on status_cards for select using (
  (status = 'published' and publish_on <= (now() at time zone 'Asia/Kolkata')::date) or my_role() in ('super_admin', 'editor'));
drop policy if exists status_write on status_cards;
create policy status_write on status_cards for all using (my_role() in ('super_admin', 'editor')) with check (my_role() in ('super_admin', 'editor'));

create or replace function bump_status_share(p_id text) returns void language sql security definer set search_path = public as $$
  update status_cards set shares = shares + 1 where id = p_id and status = 'published'
$$;
grant execute on function bump_status_share(text) to anon, authenticated;

-- Starter cards (original Chatimpu text + traditional Telugu proverbs, which are public domain).
insert into status_cards (id, kind, lang, text, attribution, background, publish_on) values
  ('seed-gm-1', 'good_morning', 'te', 'శుభోదయం! ఈ రోజు మీ ఊరిలో, మీ ఇంట్లో, మీ మనసులో వెలుగు నిండాలి.', null, 'dawn', current_date),
  ('seed-gm-2', 'good_morning', 'te', 'కొత్త రోజు, కొత్త అవకాశం. చిరునవ్వుతో మొదలుపెట్టండి. శుభోదయం!', null, 'saffron', current_date),
  ('seed-gn-1', 'good_night', 'te', 'ఈ రోజు చేసిన మంచి పనులే రేపటి ధైర్యం. శుభరాత్రి!', null, 'night', current_date),
  ('seed-pv-1', 'proverb', 'te', 'కృషితో నాస్తి దుర్భిక్షం.', 'తెలుగు సామెత', 'green', current_date),
  ('seed-pv-2', 'proverb', 'te', 'చెట్టు పేరు చెప్పి కాయలు అమ్ముకోవడం.', 'తెలుగు సామెత', 'navy', current_date),
  ('seed-mo-3', 'motivation', 'te', 'అడుగు అడుగుకీ అనుభవం, అనుభవమే గురువు.', null, 'purple', current_date),
  ('seed-pv-4', 'proverb', 'te', 'ఇంట గెలిచి రచ్చ గెలువు.', 'తెలుగు సామెత', 'red', current_date),
  ('seed-mo-1', 'motivation', 'te', 'పెద్ద మార్పు ఒక్క రోజులో రాదు. ప్రతి రోజు చిన్న అడుగు వేయండి.', null, 'red', current_date),
  ('seed-mo-2', 'motivation', 'te', 'మీ ఊరి సమస్యను మీరే మొదట గమనిస్తారు. దాన్ని లోకానికి చెప్పండి — చాటింపు చేయండి!', null, 'navy', current_date),
  ('seed-dv-1', 'devotional', 'te', 'ఓం నమః శివాయ. అందరికీ ఆరోగ్యం, శాంతి, సంతోషం కలగాలి.', null, 'saffron', current_date),
  ('seed-dv-2', 'devotional', 'te', 'సర్వే జనాః సుఖినో భవంతు — అందరూ సుఖంగా ఉండాలి.', 'శాంతి మంత్రం', 'dawn', current_date),
  ('seed-qt-1', 'quote', 'te', 'మంచి వార్త చిన్నదైనా సరే, పదిమందికి చేరితే పెద్ద మార్పు తెస్తుంది.', 'చాటింపు', 'green', current_date),
  ('seed-gm-en', 'good_morning', 'en', 'Good morning! May your day be as bright as your village sunrise.', null, 'dawn', current_date),
  ('seed-mo-en', 'motivation', 'en', 'Small steps every day beat a big leap someday.', null, 'navy', current_date)
on conflict (id) do nothing;
