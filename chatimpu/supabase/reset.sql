-- ⚠ START OVER: deletes every Chatimpu table, function and the sample data, so the
-- setup files can be run again from 0001. Only use this on a new project — it erases
-- all stories, users' profiles, polls and reports. Supabase's own auth users are kept.
-- Paste into Supabase → SQL Editor → New query → Run.

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_phone_changed on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.sync_profile_phone() cascade;

drop policy if exists "verified upload citizen media" on storage.objects;
drop policy if exists "staff upload" on storage.objects;
drop policy if exists "reporter uploads submission media" on storage.objects;
drop policy if exists "read submission media" on storage.objects;
drop policy if exists "reporter deletes own draft media" on storage.objects;
drop policy if exists "reporter uploads id document" on storage.objects;
drop policy if exists "read id documents" on storage.objects;
drop policy if exists "reporter uploads avatar" on storage.objects;
-- buckets are kept if they already hold uploaded files
delete from storage.buckets where id in ('media', 'submissions', 'reporter-private') and not exists (select 1 from storage.objects o where o.bucket_id = storage.buckets.id);

-- 0005 reporter ecosystem (wallet ledger, payouts, assignments …). ⚠ This deletes payout and ledger history.
drop view if exists reporter_public cascade;
drop table if exists tds_deductions, reporter_tax_secrets, reporter_tax_profiles cascade;
drop table if exists
  badge_awards, contributor_badges, payment_webhook_events, payment_transactions, withdrawal_requests,
  payout_method_secrets, payout_methods, wallet_ledger_entries, wallet_accounts, reporter_earnings,
  contribution_rates, editorial_reviews, submission_media, reporter_assignments, reporter_verifications,
  reporter_areas, reporter_profiles, notifications, audit_logs, staff_permissions
cascade;
drop sequence if exists submission_code_seq, earning_code_seq, assignment_code_seq, withdrawal_code_seq;

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

-- Any remaining Chatimpu functions (0005 adds many); extension-owned functions are left alone.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
             and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') loop
    execute format('drop function if exists %s cascade', f.sig);
  end loop;
end $$;

drop type if exists role_kind, story_status, report_status, reaction_kind, alert_kind, alert_severity, ad_status cascade;

select 'Reset complete — now run 0001_schema.sql' as next_step;
