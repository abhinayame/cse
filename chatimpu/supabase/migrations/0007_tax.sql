-- ════════════════════════════════════════════════════════════════════════════
-- 0007 · Tax: PAN, TDS on contributor payouts, payout & TDS reports
-- Safe to run more than once.
--
-- TDS is OFF by default. The defaults below are placeholders, NOT tax advice — have a Chartered
-- Accountant confirm the section (194J / 194C / …), rate, no-PAN rate (s.206AA) and threshold, then set
-- them in CMS → Finance → Tax & reports.
--
-- How it works when enabled:
--   * computed when finance APPROVES a withdrawal, per Indian financial year (April–March, IST);
--   * once the reporter's payouts in the FY cross the threshold, TDS applies to the whole FY amount not yet
--     taxed (so earlier small payouts are caught up), at the PAN rate if a verified PAN is on file, else the
--     no-PAN rate;
--   * the bank receives the NET amount; the wallet ledger still settles the GROSS (the TDS part is paid to
--     the government on the reporter's behalf);
--   * a rejected, failed or reversed payout voids its TDS record.
-- ════════════════════════════════════════════════════════════════════════════

insert into app_settings (key, value) values
  ('tds_enabled', 'false'),
  ('tds_section', '"194J"'),
  ('tds_rate_bps', '1000'),            -- 10.00 %  (basis points)
  ('tds_rate_no_pan_bps', '2000'),     -- 20.00 %  when no verified PAN
  ('tds_threshold_paise', '5000000')   -- ₹50,000 per financial year
on conflict (key) do nothing;

-- ── Helpers ─────────────────────────────────────────────────────────────────
create or replace function fy_of(ts timestamptz) returns text language sql immutable as $$
  select case when extract(month from (ts at time zone 'Asia/Kolkata')) >= 4
              then extract(year from (ts at time zone 'Asia/Kolkata'))::int || '-' || lpad(((extract(year from (ts at time zone 'Asia/Kolkata'))::int + 1) % 100)::text, 2, '0')
              else (extract(year from (ts at time zone 'Asia/Kolkata'))::int - 1) || '-' || lpad((extract(year from (ts at time zone 'Asia/Kolkata'))::int % 100)::text, 2, '0') end
$$;
create or replace function fy_quarter_of(ts timestamptz) returns text language sql immutable as $$
  select 'Q' || (((extract(month from (ts at time zone 'Asia/Kolkata'))::int + 8) % 12) / 3 + 1)
$$;
create or replace function setting_bool(p_key text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value #>> '{}' from app_settings where key = p_key), 'false') in ('true', 't', '1')
$$;
create or replace function setting_text(p_key text, p_default text) returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value #>> '{}' from app_settings where key = p_key), p_default)
$$;

-- ── PAN (tax profile) ───────────────────────────────────────────────────────
-- Like payout details, the full PAN is encrypted by the tax-profile Edge Function; only a masked form is
-- readable here. The full PAN is decrypted only for the audited TDS-return export.
create table if not exists reporter_tax_profiles (
  user_id uuid primary key references reporter_profiles on delete cascade,
  pan_masked text not null,
  pan_fingerprint text not null unique,
  name_on_pan text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  note text,
  verified_by uuid references profiles,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists reporter_tax_secrets (
  user_id uuid primary key references reporter_tax_profiles on delete cascade,
  ciphertext text not null,
  created_at timestamptz not null default now()
);
alter table reporter_tax_profiles enable row level security;
alter table reporter_tax_secrets enable row level security;     -- no policies: service role only
drop policy if exists tax_profile_read on reporter_tax_profiles;
create policy tax_profile_read on reporter_tax_profiles for select using (user_id = auth.uid() or has_permission('finance'));

create or replace function verify_tax_profile(p_user uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare t reporter_tax_profiles;
begin
  if not has_permission('finance') then raise exception 'Finance permission required' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'You cannot verify your own PAN'; end if;
  if p_status not in ('verified', 'failed') then raise exception 'Status must be verified or failed'; end if;
  if p_status = 'failed' and coalesce(trim(p_note), '') = '' then raise exception 'Tell the reporter what is wrong'; end if;
  update reporter_tax_profiles set status = p_status, note = p_note, verified_by = auth.uid(), verified_at = now(), updated_at = now()
  where user_id = p_user returning * into t;
  if t.user_id is null then raise exception 'No PAN on file for this reporter'; end if;
  perform audit('pan_' || p_status, 'reporter_tax_profiles', p_user::text, jsonb_build_object('pan', t.pan_masked, 'note', p_note));
  perform notify(p_user, 'tax', case when p_status = 'verified' then 'PAN verified' else 'PAN could not be verified' end,
    case when p_status = 'verified' then 'PAN ధృవీకరించబడింది' else 'PAN ధృవీకరించబడలేదు' end, coalesce(p_note, t.pan_masked), coalesce(p_note, t.pan_masked), '/reporter/profile');
end $$;

-- ── TDS ─────────────────────────────────────────────────────────────────────
alter table withdrawal_requests add column if not exists tds_paise bigint not null default 0 check (tds_paise >= 0);
alter table withdrawal_requests add column if not exists net_paise bigint;
update withdrawal_requests set net_paise = amount_paise - tds_paise where net_paise is null and status not in ('requested', 'under_review');

create table if not exists tds_deductions (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles,
  withdrawal_id uuid not null unique references withdrawal_requests,
  fy text not null,
  quarter text not null,
  section text not null,
  gross_paise bigint not null,           -- this withdrawal
  taxable_paise bigint not null,         -- amount TDS was charged on (includes FY catch-up)
  rate_bps int not null,
  tds_paise bigint not null check (tds_paise >= 0),
  pan_masked text,
  pan_verified boolean not null,
  status text not null default 'provisional' check (status in ('provisional', 'deducted', 'voided')),
  deducted_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  challan_ref text,                      -- filled in when finance deposits the TDS
  created_at timestamptz not null default now()
);
create index if not exists tds_deductions_fy_idx on tds_deductions (fy, quarter, status);
create index if not exists tds_deductions_reporter_idx on tds_deductions (reporter_id, fy);
alter table tds_deductions enable row level security;
drop policy if exists tds_read on tds_deductions;
create policy tds_read on tds_deductions for select using (reporter_id = auth.uid() or has_permission('finance'));

-- BEFORE UPDATE on withdrawal_requests: freeze gross / TDS / net at approval.
create or replace function withdrawal_tds_before() returns trigger language plpgsql security definer set search_path = public as $$
declare v_fy text; prior_gross bigint; taxed bigint; thr bigint; rate int; taxable bigint := 0; tds bigint := 0; tp reporter_tax_profiles;
begin
  if new.status = 'approved' and old.status in ('requested', 'under_review') then
    if setting_bool('tds_enabled') then
      v_fy := fy_of(now());
      thr := setting_int('tds_threshold_paise', 5000000);
      select coalesce(sum(amount_paise), 0) into prior_gross from withdrawal_requests
        where reporter_id = new.reporter_id and id <> new.id and status in ('approved', 'processing', 'paid') and fy_of(coalesce(reviewed_at, created_at)) = v_fy;
      select coalesce(sum(taxable_paise), 0) into taxed from tds_deductions where reporter_id = new.reporter_id and tds_deductions.fy = v_fy and status <> 'voided';
      if prior_gross + new.amount_paise > thr then taxable := prior_gross + new.amount_paise - taxed; end if;
      select * into tp from reporter_tax_profiles where user_id = new.reporter_id;
      rate := case when tp.status = 'verified' then setting_int('tds_rate_bps', 1000) else setting_int('tds_rate_no_pan_bps', 2000) end;
      tds := round(greatest(taxable, 0) * rate / 10000.0);
      if tds >= new.amount_paise then raise exception 'TDS (₹%) would take the whole payout; review this reporter''s tax settings', to_char(tds / 100.0, 'FM999999990.00'); end if;
      if taxable > 0 then
        insert into tds_deductions (reporter_id, withdrawal_id, fy, quarter, section, gross_paise, taxable_paise, rate_bps, tds_paise, pan_masked, pan_verified)
        values (new.reporter_id, new.id, v_fy, fy_quarter_of(now()), setting_text('tds_section', '194J'), new.amount_paise, taxable, rate, tds, tp.pan_masked, coalesce(tp.status = 'verified', false))
        on conflict (withdrawal_id) do update set taxable_paise = excluded.taxable_paise, rate_bps = excluded.rate_bps, tds_paise = excluded.tds_paise,
          status = 'provisional', voided_at = null, void_reason = null;
      end if;
    end if;
    new.tds_paise := tds;
    new.net_paise := new.amount_paise - tds;
  end if;
  return new;
end $$;
drop trigger if exists withdrawal_tds_before_trg on withdrawal_requests;
create trigger withdrawal_tds_before_trg before update of status on withdrawal_requests for each row execute function withdrawal_tds_before();

-- AFTER UPDATE: confirm on payment, void when the money did not (or no longer) reach the reporter.
create or replace function withdrawal_tds_after() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'paid' then
      update tds_deductions set status = 'deducted', deducted_at = now() where withdrawal_id = new.id and status = 'provisional';
    elsif new.status in ('rejected', 'failed', 'reversed', 'cancelled') then
      update tds_deductions set status = 'voided', voided_at = now(), void_reason = new.status || coalesce(': ' || new.reason, '')
      where withdrawal_id = new.id and status <> 'voided';
    end if;
  end if;
  return null;
end $$;
drop trigger if exists withdrawal_tds_after_trg on withdrawal_requests;
create trigger withdrawal_tds_after_trg after update of status on withdrawal_requests for each row execute function withdrawal_tds_after();

create or replace function record_tds_challan(p_fy text, p_quarter text, p_challan text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not has_permission('finance') then raise exception 'Finance permission required' using errcode = '42501'; end if;
  if coalesce(trim(p_challan), '') = '' then raise exception 'Enter the challan / CIN reference'; end if;
  update tds_deductions set challan_ref = trim(p_challan) where fy = p_fy and quarter = p_quarter and status = 'deducted' and challan_ref is null;
  get diagnostics n = row_count;
  perform audit('tds_challan_recorded', 'tds_deductions', p_fy || ' ' || p_quarter, jsonb_build_object('challan', p_challan, 'rows', n));
  return n;
end $$;

-- ── Reports (finance only) ──────────────────────────────────────────────────
create or replace function tax_report(p_fy text) returns table (
  reporter_id uuid, name text, district_id text, pan_masked text, pan_status text,
  paid_gross_paise bigint, taxable_paise bigint, tds_paise bigint, net_paid_paise bigint, payouts int, provisional_tds_paise bigint, challans text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not has_permission('finance') then raise exception 'Finance permission required' using errcode = '42501'; end if;
  return query
  with w as (
    select w.reporter_id, sum(w.amount_paise)::bigint gross, sum(coalesce(w.net_paise, w.amount_paise))::bigint net, count(*)::int n
    from withdrawal_requests w where w.status = 'paid' and fy_of(coalesce(w.paid_at, w.updated_at)) = p_fy group by w.reporter_id),
  t as (
    select d.reporter_id, sum(d.taxable_paise) filter (where d.status = 'deducted')::bigint taxable, sum(d.tds_paise) filter (where d.status = 'deducted')::bigint tds,
           sum(d.tds_paise) filter (where d.status = 'provisional')::bigint prov, string_agg(distinct d.challan_ref, ', ') challans
    from tds_deductions d where d.fy = p_fy group by d.reporter_id)
  select rp.user_id, rp.full_name, rp.district_id, tp.pan_masked, coalesce(tp.status, 'missing'),
         coalesce(w.gross, 0), coalesce(t.taxable, 0), coalesce(t.tds, 0), coalesce(w.net, 0), coalesce(w.n, 0), coalesce(t.prov, 0), t.challans
  from reporter_profiles rp
  left join w on w.reporter_id = rp.user_id left join t on t.reporter_id = rp.user_id
  left join reporter_tax_profiles tp on tp.user_id = rp.user_id
  where w.reporter_id is not null or t.reporter_id is not null
  order by coalesce(w.gross, 0) desc;
end $$;

create or replace function payout_report_monthly(p_fy text) returns table (month text, payouts int, gross_paise bigint, tds_paise bigint, net_paise bigint, reporters int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not has_permission('finance') then raise exception 'Finance permission required' using errcode = '42501'; end if;
  return query
  select to_char(date_trunc('month', w.paid_at at time zone 'Asia/Kolkata'), 'YYYY-MM'), count(*)::int, sum(w.amount_paise)::bigint,
         sum(w.tds_paise)::bigint, sum(coalesce(w.net_paise, w.amount_paise))::bigint, count(distinct w.reporter_id)::int
  from withdrawal_requests w where w.status = 'paid' and fy_of(w.paid_at) = p_fy
  group by 1 order by 1;
end $$;

-- Reporter's own FY tax summary (portal / app).
create or replace function my_tax_summary() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'fy', fy_of(now()),
    'tds_enabled', setting_bool('tds_enabled'),
    'rate_bps', setting_int('tds_rate_bps', 1000), 'rate_no_pan_bps', setting_int('tds_rate_no_pan_bps', 2000),
    'threshold_paise', setting_int('tds_threshold_paise', 5000000), 'section', setting_text('tds_section', '194J'),
    'pan', (select jsonb_build_object('masked', pan_masked, 'name', name_on_pan, 'status', status, 'note', note) from reporter_tax_profiles where user_id = auth.uid()),
    'fy_paid_gross_paise', (select coalesce(sum(amount_paise), 0) from withdrawal_requests where reporter_id = auth.uid() and status = 'paid' and fy_of(paid_at) = fy_of(now())),
    'fy_tds_paise', (select coalesce(sum(tds_paise), 0) from tds_deductions where reporter_id = auth.uid() and fy = fy_of(now()) and status = 'deducted'))
$$;

-- ── Redefined from 0005 so payouts use the NET amount (unchanged when TDS is off) ──────────────
create or replace function set_setting(p_key text, p_value jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if not (my_role() = 'super_admin'
          or (has_permission('finance') and p_key in ('withdrawal_threshold_paise', 'max_open_withdrawals', 'payouts_live_enabled',
                                                        'tds_enabled', 'tds_rate_bps', 'tds_rate_no_pan_bps', 'tds_threshold_paise', 'tds_section'))) then
    raise exception 'You do not have permission to change %', p_key using errcode = '42501';
  end if;
  if p_key = 'withdrawal_threshold_paise' and ((p_value #>> '{}')::bigint < 100 or (p_value #>> '{}')::bigint > 10000000) then
    raise exception 'Threshold must be between ₹1 and ₹1,00,000';
  end if;
  if p_key in ('tds_rate_bps', 'tds_rate_no_pan_bps') and ((p_value #>> '{}')::int < 0 or (p_value #>> '{}')::int > 3000) then
    raise exception 'TDS rate must be between 0%% and 30%%';
  end if;
  if p_key = 'tds_threshold_paise' and (p_value #>> '{}')::bigint < 0 then raise exception 'Threshold cannot be negative'; end if;
  insert into app_settings (key, value, updated_at) values (p_key, p_value, now())
    on conflict (key) do update set value = excluded.value, updated_at = now();
  perform audit('setting_changed', 'app_settings', p_key, jsonb_build_object('value', p_value));
end $$;

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
      perform notify(r.reporter_id, 'payment', 'Payment sent · ₹' || to_char(coalesce(r.net_paise, r.amount_paise) / 100.0, 'FM999999990.00'), 'చెల్లింపు పంపబడింది · ₹' || to_char(coalesce(r.net_paise, r.amount_paise) / 100.0, 'FM999999990.00'),
        coalesce('UTR ' || p_utr, r.code) || case when coalesce(r.tds_paise, 0) > 0 then ' · TDS ₹' || to_char(r.tds_paise / 100.0, 'FM999999990.00') else '' end,
        coalesce('UTR ' || p_utr, r.code) || case when coalesce(r.tds_paise, 0) > 0 then ' · TDS ₹' || to_char(r.tds_paise / 100.0, 'FM999999990.00') else '' end, '/reporter/history');
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

create or replace function record_manual_payout(p_id uuid, p_utr text, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r withdrawal_requests; tid uuid;
begin
  if not has_permission('finance') then raise exception 'Finance permission required' using errcode = '42501'; end if;
  if coalesce(trim(p_utr), '') = '' then raise exception 'Enter the bank UTR / reference number'; end if;
  select * into r from withdrawal_requests where id = p_id for update;
  if r.status not in ('approved') then raise exception 'Only approved withdrawals can be marked paid manually (this one is %)', r.status; end if;
  insert into payment_transactions (withdrawal_id, provider, provider_mode, idempotency_key, status, utr, amount_paise, created_by, request_payload)
  values (p_id, 'manual', 'live', 'manual:' || p_id, 'processed', trim(p_utr), coalesce(r.net_paise, r.amount_paise), auth.uid(), jsonb_build_object('note', p_note)) returning id into tid;
  update withdrawal_requests set status = 'processing' where id = p_id;
  perform apply_payout_status(tid, 'processed', trim(p_utr), null, null, null, null, 'manual');
  perform audit('manual_payout_recorded', 'withdrawal_requests', p_id::text, jsonb_build_object('utr', p_utr, 'note', p_note));
end $$;

do $$ begin
  revoke execute on function apply_payout_status(uuid, text, text, text, bigint, bigint, jsonb, text) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke execute on function apply_payout_status(uuid, text, text, text, bigint, bigint, jsonb, text) from anon, authenticated; end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function apply_payout_status(uuid, text, text, text, bigint, bigint, jsonb, text) to service_role; end if;
end $$;
