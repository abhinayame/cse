/**
 * Test helpers. Every actor is a real Supabase Auth user signed in with a password, so
 * every request goes through PostgREST + row-level security exactly as in production.
 * Admin setup (roles, permissions) uses the service-role key, as an operator would.
 */
import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const ANON = process.env.SUPABASE_ANON_KEY ?? '';
export const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!ANON || !SERVICE) throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY');

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const service = createClient(URL, SERVICE, opts);

const run = Date.now().toString(36);

export interface Actor { id: string; email: string; db: SupabaseClient }

export async function actor(name: string, setup?: { role?: string; permissions?: string[]; districts?: string[] }): Promise<Actor> {
  const email = `${name}.${run}@test.chatimpu`;
  const password = 'Test-pass-123!';
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const id = data.user!.id;
  if (setup?.role) must(await service.from('profiles').update({ role: setup.role, display_name: name }).eq('id', id));
  for (const p of setup?.permissions ?? []) must(await service.from('staff_permissions').insert({ user_id: id, permission: p }));
  for (const d of setup?.districts ?? []) must(await service.from('moderator_districts').insert({ user_id: id, district_id: d }));
  const db = createClient(URL, ANON, opts);
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id, email, db };
}

export function must<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

/** Expect a call to fail; returns the error message. */
export async function fails(p: PromiseLike<{ error: { message: string } | null }>, match?: RegExp): Promise<string> {
  const { error } = await p;
  if (!error) throw new Error(`Expected an error${match ? ` matching ${match}` : ''}, but the call succeeded`);
  if (match && !match.test(error.message)) throw new Error(`Error "${error.message}" does not match ${match}`);
  return error.message;
}

export async function wallet(a: Actor) {
  const r = must(await a.db.from('wallet_accounts').select('available_paise, reserved_paise, paid_paise, lifetime_earned_paise').eq('reporter_id', a.id).maybeSingle());
  return r ?? { available_paise: 0, reserved_paise: 0, paid_paise: 0, lifetime_earned_paise: 0 };
}

/** Register + verify + activate a reporter (identity verification approved). */
export async function activeReporter(name: string, editor: Actor, district = 'hyd', mandal = 'hyd-amp'): Promise<Actor> {
  const r = await actor(name);
  must(await r.db.rpc('register_reporter', {
    p_full_name: `Reporter ${name}`, p_email: null, p_district: district, p_mandal: mandal, p_locality: 'Ward 7', p_language: 'te',
    p_interests: ['civic', 'education'], p_intro: 'Local contributor', p_photo_path: null, p_accept_agreement: true,
  }));
  must(await r.db.rpc('submit_verification', { p_document_type: 'voter_id', p_last4: '4821', p_document_path: `${r.id}/id.jpg` }));
  must(await editor.db.rpc('review_reporter', { p_user: r.id, p_decision: 'verify' }));
  must(await editor.db.rpc('review_reporter', { p_user: r.id, p_decision: 'approve' }));
  return r;
}

export const SUMMARY = 'Residents of the ward said the streetlights on the main road had been off for two weeks. Municipal staff replaced the faulty cables on Monday evening, and officials said regular checks will now be done every month to avoid such delays.';

let n = 0;
/** Create and submit a story; returns the submission row (now under review). */
export async function submitStory(r: Actor, over: Record<string, unknown> = {}) {
  n++;
  // Every story is a different incident (unique place words), so the duplicate auto-reject (0008) leaves them alone.
  const w = () => Array.from({ length: 2 }, () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 7)).join(' ');
  const place = w(), thing = w();
  const row = must(await r.db.from('citizen_reports').insert({
    headline: `Ward ${n} ${run}: ${place} ${thing} ${w()}`,
    body: `${place} ${thing}: ${Array.from({ length: 8 }, w).join(', ')}.`,
    lang: 'en', category_id: 'education', district_id: 'hyd', mandal_id: 'hyd-amp', rights_confirmed: true, status: 'draft', ...over,
  }).select('*').single()) as Record<string, any>;
  return must(await r.db.from('citizen_reports').update({ status: 'submitted' }).eq('id', row.id).select('*').single()) as Record<string, any>;
}

export async function approve(editor: Actor, id: string, contribution: string, amount: number, publish = true) {
  return must(await editor.db.rpc('editorial_approve', {
    p_id: id, p_headline: 'Approved headline for the story', p_summary: SUMMARY,
    p_contribution: contribution, p_amount_paise: amount, p_publish: publish,
  })) as { story_id: string; earning: { code: string; amount_paise: number } | null };
}

/** A verified payout method, inserted the way the payout-methods Edge Function does (service role). */
export async function verifiedMethod(r: Actor, finance: Actor, kind: 'upi' | 'bank' = 'upi') {
  const m = must(await service.from('payout_methods').insert({
    reporter_id: r.id, kind, holder_name: 'Test Reporter', masked: kind === 'upi' ? 'te•••@okaxis' : '••••••4321',
    ifsc: kind === 'bank' ? 'HDFC0000053' : null, fingerprint: `fp-${r.id}-${kind}-${Math.random()}`,
  }).select('id').single()) as { id: string };
  must(await service.from('payout_method_secrets').insert({ method_id: m.id, ciphertext: 'test-ciphertext' }));
  must(await finance.db.rpc('verify_payout_method', { p_id: m.id, p_status: 'verified', p_note: 'test' }));
  return m.id;
}

/**
 * Test isolation for the duplicate auto-reject (0008): earlier test runs leave identical stories behind,
 * which are real duplicates of this run's. Move them outside the comparison window. Needs psql (PGURL).
 */
export function ageEarlierReports() {
  const pg = process.env.PGURL ?? 'postgres://postgres@127.0.0.1:54329/sb';
  execFileSync('psql', [pg, '-tAq', '-c', "update citizen_reports set submitted_at = submitted_at - interval '30 days' where submitted_at > now() - interval '30 days'"]);
}
