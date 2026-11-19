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
