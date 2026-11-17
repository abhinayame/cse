/**
 * Scheduled jobs (migrations/0006_jobs.sql + functions/_shared/jobs): push delivery, token linking,
 * data retention. Backdating timestamps needs direct SQL (triggers keep updated_at honest), so these
 * tests also use psql — set PGURL (default: the local test stack).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { ANON, URL, activeReporter, actor, fails, must, service, type Actor } from './helpers.ts';
import { dispatchPushes, runMaintenance } from '../functions/_shared/jobs/index.ts';

const PG = process.env.PGURL ?? 'postgres://postgres@127.0.0.1:54329/sb';
const sql = (q: string) => execFileSync('psql', [PG, '-tAq', '-v', 'ON_ERROR_STOP=1', '-c', q], { encoding: 'utf8' }).trim();
const token = () => `ExponentPushToken[${Math.random().toString(36).slice(2, 14)}${Math.random().toString(36).slice(2, 10)}]`;

let editor: Actor;
before(async () => {
  editor = await actor('je', { role: 'editor' });
  // Earlier test files leave undelivered notifications behind; mark them sent so each test sees only its own.
  sql(`update notifications set push_sent_at = now() where push_sent_at is null`);
});

/** Fake Expo endpoint: records messages; tokens listed in `dead` come back as DeviceNotRegistered. */
function fakeExpo(dead: string[] = []) {
  const sent: { to: string; title: string; body?: string; data: { url?: string; kind: string }; channelId: string }[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    const msgs = JSON.parse(String(init.body)) as typeof sent;
    sent.push(...msgs);
    return new Response(JSON.stringify({ data: msgs.map((m) => (dead.includes(m.to) ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok', id: 'x' })) }), { status: 200 });
  }) as typeof fetch;
  return { sent, fetchImpl };
}

test('push tokens: registered through the API, re-linked to whoever signs in on the device', async () => {
  const a = await actor('pa'); const b = await actor('pb');
  const t = token();
  const args = { p_token: t, p_platform: 'android', p_district: 'hyd', p_mandal: 'hyd-amp', p_language: 'te', p_interests: ['education'], p_prefs: null };
  must(await a.db.rpc('register_push_token', args));
  assert.equal(sql(`select user_id from push_tokens where token = '${t}'`), a.id);
  must(await b.db.rpc('register_push_token', args)); // same phone, different account
  assert.equal(sql(`select user_id from push_tokens where token = '${t}'`), b.id);
  // signed-out readers can register for story pushes
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const t2 = token();
  must(await anon.rpc('register_push_token', { ...args, p_token: t2 }));
  assert.equal(sql(`select coalesce(user_id::text, 'null') from push_tokens where token = '${t2}'`), 'null');
  await fails(a.db.rpc('register_push_token', { ...args, p_token: 'not-a-token' }), /Invalid push token/);
});

test('push dispatch: Telugu text, deep link, dead tokens removed, never sent twice (even concurrently)', async () => {
  const r = await activeReporter('push', editor); // registration + verification create notifications
  const live = token(), dead = token();
  for (const t of [live, dead]) must(await r.db.rpc('register_push_token', { p_token: t, p_platform: 'android', p_district: 'hyd', p_mandal: 'hyd-amp', p_language: 'te', p_interests: [], p_prefs: null }));
  await fails(r.db.rpc('claim_push_batch', { p_limit: 10 })); // service only

  const expo = fakeExpo([dead]);
  const [x, y] = await Promise.all([dispatchPushes(service, expo.fetchImpl), dispatchPushes(service, expo.fetchImpl)]);
  const mine = expo.sent.filter((m) => m.to === live);
  const n = Number(sql(`select count(*) from notifications where user_id = '${r.id}'`));
  assert.ok(n >= 3, 'registration and verification notifications exist');
  assert.equal(mine.length, n, 'each notification pushed exactly once to the live device');
  assert.equal(x.notifications + y.notifications >= n, true);
  const active = mine.find((m) => m.data.kind === 'verification' && m.title.includes('సక్రియం'));
  assert.ok(active, 'Telugu title for a Telugu device');
  assert.match(active!.data.url ?? '', /^chatimpu:\/\/reporter/);
  assert.equal(sql(`select count(*) from push_tokens where token = '${dead}'`), '0', 'DeviceNotRegistered token removed');
  const again = await dispatchPushes(service, fakeExpo().fetchImpl);
  assert.equal(again.pushes, 0, 'nothing left to send');
});

test('retention: decided ID documents are deleted from storage after the retention period; pending ones are kept', async () => {
  const r = await actor('ret-id');
  must(await r.db.rpc('register_reporter', { p_full_name: 'Retention Test', p_email: null, p_district: 'hyd', p_mandal: 'hyd-amp', p_locality: null, p_language: 'te', p_interests: [], p_intro: null, p_photo_path: null, p_accept_agreement: true }));
  const path = `${r.id}/id/${Date.now()}-doc.png`;
  must(await r.db.storage.from('reporter-private').upload(path, new Blob(['png'], { type: 'image/png' })));
  must(await r.db.rpc('submit_verification', { p_document_type: 'voter_id', p_last4: '1234', p_document_path: path }));
  must(await editor.db.rpc('review_reporter', { p_user: r.id, p_decision: 'verify' }));

  let res = await runMaintenance(service);
  assert.deepEqual(res.errors, []);
  assert.equal(sql(`select document_path from reporter_verifications where user_id = '${r.id}'`), path, 'kept within the retention period');

  sql(`update reporter_verifications set reviewed_at = now() - interval '31 days' where user_id = '${r.id}'`);
  res = await runMaintenance(service);
  assert.deepEqual(res.errors, []);
  assert.ok(res.id_documents_purged >= 1);
  assert.equal(sql(`select coalesce(document_path, 'null') || '|' || (document_purged_at is not null) || '|' || status || '|' || document_last4 from reporter_verifications where user_id = '${r.id}'`), 'null|true|approved|1234',
    'image gone, decision and last-4 kept');
  const dl = await editor.db.storage.from('reporter-private').download(path);
  assert.ok(dl.error, 'file removed from storage');
  assert.ok(Number(sql(`select count(*) from audit_logs where action = 'retention_id_documents_purged'`)) >= 1);
});

test('retention: stale drafts get a warning first, editing resets it, then they are deleted with their media', async () => {
  const r = await activeReporter('ret-draft', editor);
  const d = must(await r.db.from('citizen_reports').insert({ headline: 'An old draft that was never sent', body: 'x'.repeat(60), lang: 'en', category_id: 'education', district_id: 'hyd', status: 'draft' }).select('id').single()) as { id: string };
  const path = `${r.id}/${d.id}/photo.jpg`;
  must(await r.db.storage.from('submissions').upload(path, new Blob(['jpg'], { type: 'image/jpeg' })));
  must(await r.db.from('submission_media').insert({ submission_id: d.id, kind: 'photo', bucket: 'submissions', storage_path: path }));
  // Backdate without triggers (they stamp updated_at on every update, which is exactly what we rely on).
  const age = (days: number, warnedDaysAgo?: number) => sql(`alter table citizen_reports disable trigger user;
    update citizen_reports set updated_at = now() - interval '${days} days'${warnedDaysAgo ? `, draft_expiry_warned_at = now() - interval '${warnedDaysAgo} days'` : ''} where id = '${d.id}';
    alter table citizen_reports enable trigger user;`);

  age(85); // inside the warning window (90 − 7)
  let res = await runMaintenance(service);
  assert.ok(res.drafts_warned >= 1);
  assert.equal(sql(`select (draft_expiry_warned_at is not null) || '|' || (updated_at < now() - interval '80 days') from citizen_reports where id = '${d.id}'`), 'true|true', 'warning recorded without touching updated_at');
  assert.equal(sql(`select count(*) from notifications where user_id = '${r.id}' and kind = 'draft_expiring'`), '1');

  must(await r.db.from('citizen_reports').update({ body: 'y'.repeat(60) }).eq('id', d.id)); // the reporter edits it
  assert.equal(sql(`select draft_expiry_warned_at is null from citizen_reports where id = '${d.id}'`), 't', 'editing resets the warning');

  age(95, 8); // past the retention period, warned more than a day ago
  res = await runMaintenance(service);
  assert.deepEqual(res.errors, []);
  assert.equal(sql(`select count(*) from citizen_reports where id = '${d.id}'`), '0', 'draft deleted');
  assert.ok((await service.storage.from('submissions').download(path)).error, 'media file deleted');
});

test('retention: old read notifications and raw webhook payloads are cleared; scheduler needs pg_cron', async () => {
  const r = await actor('ret-n');
  sql(`insert into notifications (user_id, kind, title_en, read_at, created_at) values ('${r.id}', 'x', 'old read', now() - interval '200 days', now() - interval '200 days'), ('${r.id}', 'x', 'recent read', now(), now())`);
  sql(`insert into payment_webhook_events (provider, event_id, signature_valid, payload, received_at) values ('razorpayx', 'evt_ret_${Date.now()}', true, '{"secret":"x"}', now() - interval '200 days')`);
  await runMaintenance(service);
  assert.equal(sql(`select string_agg(title_en, ',') from notifications where user_id = '${r.id}'`), 'recent read');
  assert.equal(sql(`select count(*) from payment_webhook_events where payload <> '{}'::jsonb and received_at < now() - interval '190 days'`), '0');
  // the local stack has no pg_cron: the setup function must explain what to enable
  await fails(service.rpc('setup_scheduled_jobs', { p_project_url: 'https://example.supabase.co', p_cron_secret: 'a-very-long-cron-secret' }), /pg_cron/);
  await fails(editor.db.rpc('setup_scheduled_jobs', { p_project_url: 'https://example.supabase.co', p_cron_secret: 'a-very-long-cron-secret' }), /Super admin only/);
});
