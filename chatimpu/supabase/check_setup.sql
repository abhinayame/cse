-- Paste into Supabase → SQL Editor → New query → Run.
-- Shows which Chatimpu setup steps are already done. Safe: it only reads.
select step, case when done then '✅ done' else '❌ not yet — run this file' end as status
from (values
  (1, '0001_schema.sql', exists (select 1 from pg_class where relname = 'stories' and relnamespace = 'public'::regnamespace)),
  (2, '0002_rls.sql',    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'stories')),
  (3, '0003_api.sql',    exists (select 1 from pg_proc where proname = 'get_feed')),
  (4, '0004_cms.sql',    exists (select 1 from pg_class where relname = 'cms_stories')),
  (5, '0005_reporters.sql', exists (select 1 from pg_class where relname = 'wallet_ledger_entries' and relnamespace = 'public'::regnamespace)
                            and exists (select 1 from pg_proc where proname = 'sync_profile_phone')),
  (6, '0006_jobs.sql',  exists (select 1 from pg_proc where proname = 'claim_push_batch')),
  (7, '0007_tax.sql',   exists (select 1 from pg_class where relname = 'tds_deductions' and relnamespace = 'public'::regnamespace)),
  (8, '0008_content.sql', exists (select 1 from pg_class where relname = 'news_sources' and relnamespace = 'public'::regnamespace)),
  (9, '0009_community.sql', exists (select 1 from pg_class where relname = 'grievances' and relnamespace = 'public'::regnamespace)),
  (10, 'seed.sql',        exists (select 1 from pg_class where relname = 'stories' and reltuples > 0)
                         or exists (select 1 from pg_stat_user_tables where relname = 'stories' and n_live_tup > 0))
) as t(n, step, done)
order by n;
