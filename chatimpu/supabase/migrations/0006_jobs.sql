-- ════════════════════════════════════════════════════════════════════════════
-- 0006 · Scheduled jobs: push delivery, scheduled publishing, data retention
-- Safe to run more than once.
--
--   * notify-dispatch (every minute): delivers in-app notifications as push messages
--   * publish_due()  (every minute): publishes scheduled stories
--   * maintenance    (daily 02:30 IST): data-retention sweep (see retention_* settings)
--
-- After running this file, call once (SQL Editor) with your project URL and the CRON_SECRET you set on
-- the Edge Functions:   select setup_scheduled_jobs('https://<ref>.supabase.co', '<CRON_SECRET>');
-- It needs the pg_cron and pg_net extensions (Database → Extensions).
--
-- What is kept, and why (needs legal review — see docs/REPORTER_ECOSYSTEM.md §12):
--   ledger, earnings, withdrawals, payment transactions, audit logs, tax records → never deleted here
--   (accounting and tax law require multi-year retention).
-- ════════════════════════════════════════════════════════════════════════════

insert into app_settings (key, value) values
  ('retention_id_document_days', '30'),       -- delete ID document images this many days after the decision
  ('retention_draft_days', '90'),             -- delete untouched drafts (and their media) after this many days
  ('retention_draft_warning_days', '7'),      -- warn the reporter this many days before a draft is deleted
  ('retention_notification_days', '180'),     -- delete read notifications after this many days (unread: 2×)
  ('retention_webhook_payload_days', '180')   -- clear raw webhook payloads (event ids are kept for de-duplication)
on conflict (key) do nothing;

alter table reporter_verifications add column if not exists document_purged_at timestamptz;
alter table citizen_reports add column if not exists draft_expiry_warned_at timestamptz;
alter table notifications add column if not exists push_attempts int not null default 0;
create index if not exists notifications_push_queue_idx on notifications (created_at) where push_sent_at is null;
create index if not exists citizen_reports_draft_age_idx on citizen_reports (updated_at) where status = 'draft';

-- ── Push queue ───────────────────────────────────────────────────────────────
-- Claims a batch atomically (SKIP LOCKED), so overlapping dispatcher runs never send the same push twice.
create or replace function claim_push_batch(p_limit int default 200)
returns table (id uuid, user_id uuid, kind text, title_en text, title_te text, body_en text, body_te text, link text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_service_caller() then raise exception 'Service role only' using errcode = '42501'; end if;
  return query
  with batch as (
    select n.id from notifications n
    where n.push_sent_at is null and n.created_at > now() - interval '2 days'
    order by n.created_at limit greatest(1, least(p_limit, 500))
    for update skip locked)
  update notifications n set push_sent_at = now(), push_attempts = n.push_attempts + 1
  from batch where n.id = batch.id
  returning n.id, n.user_id, n.kind, n.title_en, n.title_te, n.body_en, n.body_te, n.link;
end $$;

-- Device push tokens. A token belongs to a device, so whoever registers it now owns it: this re-links the
-- device after sign-in or an account switch (the table's RLS alone cannot move a row between users), and
-- lets signed-out readers receive story pushes (user_id null).
create or replace function register_push_token(p_token text, p_platform text, p_district text, p_mandal text,
  p_language text, p_interests text[], p_prefs jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$' then raise exception 'Invalid push token'; end if;
  insert into push_tokens (token, user_id, platform, district_id, mandal_id, language, interests, prefs)
  values (p_token, auth.uid(), left(p_platform, 20), p_district, p_mandal, left(p_language, 8), coalesce(p_interests, '{}'),
          coalesce(p_prefs, '{"breaking":true,"local":true,"digest":true,"interests":true}'))
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, district_id = excluded.district_id,
    mandal_id = excluded.mandal_id, language = excluded.language, interests = excluded.interests, prefs = excluded.prefs;
end $$;
grant execute on function register_push_token(text, text, text, text, text, text[], jsonb) to anon, authenticated;

-- ── Retention: database-only parts (files are removed by the maintenance Edge Function) ─────────────
create or replace function retention_sweep_sql() returns jsonb language plpgsql security definer set search_path = public as $$
declare n_read int; n_unread int; n_hooks int; n_warned int; days int := setting_int('retention_notification_days', 180);
        d_days int := setting_int('retention_draft_days', 90); w_days int := setting_int('retention_draft_warning_days', 7);
begin
  if not is_service_caller() then raise exception 'Service role only' using errcode = '42501'; end if;
  delete from notifications where read_at is not null and created_at < now() - make_interval(days => days);
  get diagnostics n_read = row_count;
  delete from notifications where read_at is null and created_at < now() - make_interval(days => days * 2);
  get diagnostics n_unread = row_count;
  update payment_webhook_events set payload = '{}'::jsonb
   where payload <> '{}'::jsonb and received_at < now() - make_interval(days => setting_int('retention_webhook_payload_days', 180)::int);
  get diagnostics n_hooks = row_count;
  -- warn before deleting stale drafts
  with w as (
    update citizen_reports set draft_expiry_warned_at = now()
    where status = 'draft' and draft_expiry_warned_at is null and updated_at < now() - make_interval(days => greatest(d_days - w_days, 1))
    returning id, reporter_id, coalesce(nullif(headline, ''), '—') h)
  select count(*) into n_warned from (
    select notify(w.reporter_id, 'draft_expiring', 'Draft will be deleted in ' || w_days || ' days', 'డ్రాఫ్ట్ ' || w_days || ' రోజుల్లో తొలగించబడుతుంది',
                  left(w.h, 80) || ' — open and send it, or it will be removed.', left(w.h, 80) || ' — తెరిచి పంపండి, లేకపోతే తొలగించబడుతుంది.', '/reporter/submit/' || w.id)
    from w) x;
  return jsonb_build_object('notifications_read_deleted', n_read, 'notifications_unread_deleted', n_unread, 'webhook_payloads_cleared', n_hooks, 'drafts_warned', n_warned);
end $$;

-- Candidates whose FILES must be removed through the Storage API (direct deletes on storage.objects
-- are blocked on Supabase). The maintenance function deletes the files, then calls the *_done functions.
create or replace function retention_file_candidates(p_limit int default 200) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_service_caller() then raise exception 'Service role only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'id_documents', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'path', v.document_path)), '[]') from (
        select id, document_path from reporter_verifications
        where document_path is not null and status in ('approved', 'rejected')
          and reviewed_at < now() - make_interval(days => setting_int('retention_id_document_days', 30)::int)
        order by reviewed_at limit p_limit) v),
    'drafts', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'media',
        (select coalesce(jsonb_agg(jsonb_build_object('bucket', m.bucket, 'path', m.storage_path)), '[]') from submission_media m where m.submission_id = d.id))), '[]') from (
        select id from citizen_reports
        where status = 'draft' and draft_expiry_warned_at is not null
          and updated_at < now() - make_interval(days => setting_int('retention_draft_days', 90)::int)
          and draft_expiry_warned_at < now() - make_interval(days => 1)
        order by updated_at limit p_limit) d));
end $$;

create or replace function retention_id_documents_done(p_ids uuid[]) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_service_caller() then raise exception 'Service role only' using errcode = '42501'; end if;
  update reporter_verifications set document_path = null, document_purged_at = now() where id = any(p_ids) and document_path is not null;
  get diagnostics n = row_count;
  if n > 0 then insert into audit_logs (action, entity, details) values ('retention_id_documents_purged', 'reporter_verifications', jsonb_build_object('count', n)); end if;
  return n;
end $$;

create or replace function retention_drafts_done(p_ids uuid[]) returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_service_caller() then raise exception 'Service role only' using errcode = '42501'; end if;
  -- only rows that are still stale drafts (a reporter may have edited one since the candidates were read)
  delete from citizen_reports where id = any(p_ids) and status = 'draft'
    and updated_at < now() - make_interval(days => setting_int('retention_draft_days', 90)::int);
  get diagnostics n = row_count;
  if n > 0 then insert into audit_logs (action, entity, details) values ('retention_drafts_deleted', 'citizen_reports', jsonb_build_object('count', n)); end if;
  return n;
end $$;

-- Editing a draft resets its expiry warning. Runs after citizen_reports_before_trg (triggers fire in name
-- order), which stamps updated_at on every update: when only the warning column changed we restore the old
-- updated_at, otherwise recording the warning would make the draft look freshly edited.
create or replace function reset_draft_warning() returns trigger language plpgsql as $$
begin
  if (to_jsonb(new) - 'updated_at' - 'draft_expiry_warned_at') = (to_jsonb(old) - 'updated_at' - 'draft_expiry_warned_at') then
    new.updated_at := old.updated_at;
  elsif new.status = 'draft' then
    new.draft_expiry_warned_at := null;
  end if;
  return new;
end $$;
drop trigger if exists citizen_reports_draft_warning_trg on citizen_reports;
create trigger citizen_reports_draft_warning_trg before update on citizen_reports for each row execute function reset_draft_warning();

-- ── Scheduling (pg_cron + pg_net) ───────────────────────────────────────────
-- Stores the cron secret in Supabase Vault when available, then (re)creates the three jobs.
create or replace function setup_scheduled_jobs(p_project_url text, p_cron_secret text) returns text
language plpgsql security definer set search_path = public as $$
declare base text := rtrim(p_project_url, '/') || '/functions/v1'; secret_sql text; has_vault boolean;
begin
  if not (my_role() = 'super_admin' or is_service_caller()) then raise exception 'Super admin only' using errcode = '42501'; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then raise exception 'Enable the pg_cron extension first (Database → Extensions)'; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then raise exception 'Enable the pg_net extension first (Database → Extensions)'; end if;
  if p_project_url !~ '^https://' or length(coalesce(p_cron_secret, '')) < 16 then raise exception 'Give the https project URL and a CRON_SECRET of at least 16 characters'; end if;

  has_vault := exists (select 1 from pg_namespace where nspname = 'vault');
  if has_vault then
    execute 'delete from vault.secrets where name = ''chatimpu_cron_secret''';
    execute 'select vault.create_secret($1, ''chatimpu_cron_secret'')' using p_cron_secret;
    secret_sql := '(select decrypted_secret from vault.decrypted_secrets where name = ''chatimpu_cron_secret'')';
  else
    secret_sql := quote_literal(p_cron_secret);
  end if;

  perform cron.unschedule(jobname) from cron.job where jobname in ('chatimpu-notify-dispatch', 'chatimpu-maintenance', 'chatimpu-publish-due', 'publish-scheduled');
  perform cron.schedule('chatimpu-publish-due', '* * * * *', 'select public.publish_due()');
  perform cron.schedule('chatimpu-notify-dispatch', '* * * * *', format(
    'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', %s), body := ''{}''::jsonb, timeout_milliseconds := 20000)',
    base || '/notify-dispatch', secret_sql));
  perform cron.schedule('chatimpu-maintenance', '0 21 * * *', format(   -- 21:00 UTC = 02:30 IST
    'select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', %s), body := ''{}''::jsonb, timeout_milliseconds := 60000)',
    base || '/maintenance', secret_sql));
  insert into audit_logs (actor_id, action, entity, details) values (auth.uid(), 'scheduled_jobs_configured', 'cron', jsonb_build_object('project_url', p_project_url, 'vault', has_vault));
  return 'Scheduled: chatimpu-publish-due (every minute), chatimpu-notify-dispatch (every minute), chatimpu-maintenance (daily 02:30 IST)'
         || case when has_vault then '' else ' — WARNING: Vault not found, the secret is stored in the cron command' end;
end $$;

-- Internal / service-only functions are not callable through the API by signed-in users.
do $$ declare f text; begin
  foreach f in array array['claim_push_batch(int)', 'retention_sweep_sql()', 'retention_file_candidates(int)',
                           'retention_id_documents_done(uuid[])', 'retention_drafts_done(uuid[])'] loop
    execute format('revoke execute on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke execute on function %s from anon', f); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke execute on function %s from authenticated', f); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function %s to service_role', f); end if;
  end loop;
  execute 'revoke execute on function setup_scheduled_jobs(text, text) from public';
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke execute on function setup_scheduled_jobs(text, text) from anon'; end if;
  -- the function itself allows only super admins (or the service role)
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'grant execute on function setup_scheduled_jobs(text, text) to authenticated'; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function setup_scheduled_jobs(text, text) to service_role'; end if;
end $$;
