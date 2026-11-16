-- ⚠ START OVER: deletes every Chatimpu table, function and the sample data, so the
-- setup files can be run again from 0001. Only use this on a new project — it erases
-- all stories, users' profiles, polls and reports. Supabase's own auth users are kept.
-- Paste into Supabase → SQL Editor → New query → Run.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;

drop policy if exists "verified upload citizen media" on storage.objects;
drop policy if exists "staff upload" on storage.objects;
-- the bucket is kept if it already holds uploaded files
delete from storage.buckets where id = 'media' and not exists (select 1 from storage.objects where bucket_id = 'media');

drop view if exists cms_stories, analytics_district, analytics_retention, analytics_category, analytics_daily, video_feed cascade;

drop table if exists
  app_settings, push_tokens, videos, ads, advertisers, citizen_reports, local_alerts,
  magazine_stories, magazines, votes, poll_option_labels, poll_options, poll_questions, polls,
  read_events, comments, reactions, bookmarks, story_tags, story_translations, stories,
  moderator_districts, profiles, villages, mandals, districts, states,
  category_names, categories, languages
cascade;

drop function if exists
  image_url(text, int), story_json(stories), get_feed(text, text, text, int, timestamptz),
  get_polls_with_results(), cast_vote(text, text, text), log_events(jsonb),
  search_stories(text, text, text, interval, text), approve_report(uuid, text, text, text, text),
  publish_due(), touch_updated_at(), my_role(), is_staff(), moderates(text)
cascade;

drop type if exists role_kind, story_status, report_status, reaction_kind, alert_kind, alert_severity, ad_status cascade;

select 'Reset complete — now run 0001_schema.sql' as next_step;
