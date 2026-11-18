/**
 * PAN capture and the TDS-return worksheet (migrations/0007_tax.sql).
 * The full PAN is AES-GCM encrypted with PAYOUT_ENCRYPTION_KEY and only ever decrypted for the
 * finance export, which is audited; everything else sees the masked form.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptJson, encryptJson, fingerprint } from './crypto.ts';
import { HttpError, payoutConfig } from './service.ts';

type Env = (k: string) => string | undefined;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const maskPan = (pan: string) => `••••••${pan.slice(-4)}`;

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new HttpError(400, r.error.message);
  return r.data as T;
}

export async function addTaxProfile(db: SupabaseClient, env: Env, userId: string, input: { pan?: string; name?: string }) {
  const cfg = payoutConfig(env);
  const pan = (input.pan ?? '').replace(/\s/g, '').toUpperCase();
  const name = (input.name ?? '').trim().replace(/\s+/g, ' ');
  if (!PAN_RE.test(pan)) throw new HttpError(422, 'Enter a valid 10-character PAN, for example ABCDE1234F');
  if (name.length < 3 || name.length > 85 || !/^[\p{L} .'-]+$/u.test(name)) throw new HttpError(422, 'Enter your name exactly as it appears on the PAN card');

  const rp = check(await db.from('reporter_profiles').select('status').eq('user_id', userId).maybeSingle()) as { status: string } | null;
  if (!rp) throw new HttpError(403, 'Register as a reporter first');
  const existing = check(await db.from('reporter_tax_profiles').select('status').eq('user_id', userId).maybeSingle()) as { status: string } | null;
  if (existing?.status === 'verified') throw new HttpError(409, 'Your PAN is already verified. Contact support to change it.');

  const fp = await fingerprint(['pan', pan], cfg.encryptionKey);
  const taken = check(await db.from('reporter_tax_profiles').select('user_id').eq('pan_fingerprint', fp).neq('user_id', userId).maybeSingle()) as { user_id: string } | null;
  if (taken) throw new HttpError(409, 'This PAN is already registered to another reporter account. Contact support.');

  const row = { user_id: userId, pan_masked: maskPan(pan), pan_fingerprint: fp, name_on_pan: name, status: 'pending', note: null, verified_by: null, verified_at: null, updated_at: new Date().toISOString() };
  check(await db.from('reporter_tax_profiles').upsert(row, { onConflict: 'user_id' }));
  check(await db.from('reporter_tax_secrets').upsert({ user_id: userId, ciphertext: await encryptJson({ pan, name }, cfg.encryptionKey) }, { onConflict: 'user_id' }));
  await db.from('audit_logs').insert({ actor_id: userId, action: 'pan_submitted', entity: 'reporter_tax_profiles', entity_id: userId, details: { pan: maskPan(pan) } });
  return { pan_masked: row.pan_masked, name_on_pan: name, status: 'pending' };
}

/** Worksheet for the quarterly TDS return (Form 26Q): one row per deduction, with full PAN. Audited. */
export async function exportTdsCsv(db: SupabaseClient, env: Env, actorId: string, fy: string, quarter?: string) {
  if (!/^\d{4}-\d{2}$/.test(fy) || (quarter && !/^Q[1-4]$/.test(quarter))) throw new HttpError(422, 'Choose a financial year like 2026-27 and quarter Q1–Q4');
  const cfg = payoutConfig(env);
  let q = db.from('tds_deductions').select('id, reporter_id, withdrawal_id, fy, quarter, section, gross_paise, taxable_paise, rate_bps, tds_paise, pan_verified, deducted_at, challan_ref')
    .eq('fy', fy).eq('status', 'deducted');
  if (quarter) q = q.eq('quarter', quarter);
  const rows = check(await q.order('deducted_at')) as { reporter_id: string; withdrawal_id: string; quarter: string; section: string; gross_paise: number; taxable_paise: number; rate_bps: number; tds_paise: number; pan_verified: boolean; deducted_at: string; challan_ref: string | null }[];
  const ids = [...new Set(rows.map((r) => r.reporter_id))].concat(['00000000-0000-0000-0000-000000000000']);
  const secrets = new Map((check(await db.from('reporter_tax_secrets').select('user_id, ciphertext').in('user_id', ids)) as { user_id: string; ciphertext: string }[]).map((s) => [s.user_id, s.ciphertext]));
  const names = new Map((check(await db.from('reporter_profiles').select('user_id, full_name').in('user_id', ids)) as { user_id: string; full_name: string }[]).map((r) => [r.user_id, r.full_name]));
  const codes = new Map((check(await db.from('withdrawal_requests').select('id, code').in('id', rows.map((r) => r.withdrawal_id).concat(['00000000-0000-0000-0000-000000000000']))) as { id: string; code: string }[]).map((r) => [r.id, r.code]));
  const esc = (v: string | number) => { const s = String(v); return `"${(/^[=+\-@\t\r]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"`; };
  const lines = [['quarter', 'section', 'deductee_name', 'pan', 'pan_name', 'pan_verified', 'withdrawal', 'paid_on', 'gross_inr', 'taxable_inr', 'rate_percent', 'tds_inr', 'challan'].join(',')];
  for (const r of rows) {
    const c = secrets.get(r.reporter_id);
    const p = c ? await decryptJson<{ pan: string; name: string }>(c, cfg.encryptionKey) : null;
    lines.push([r.quarter, r.section, names.get(r.reporter_id) ?? '', p?.pan ?? 'PANNOTAVBL', p?.name ?? '', r.pan_verified ? 'yes' : 'no', codes.get(r.withdrawal_id) ?? '',
      (r.deducted_at ?? '').slice(0, 10), (r.gross_paise / 100).toFixed(2), (r.taxable_paise / 100).toFixed(2), (r.rate_bps / 100).toFixed(2), (r.tds_paise / 100).toFixed(2), r.challan_ref ?? ''].map(esc).join(','));
  }
  await db.from('audit_logs').insert({ actor_id: actorId, action: 'tds_worksheet_exported', entity: 'tds_deductions', entity_id: `${fy} ${quarter ?? 'all'}`, details: { rows: rows.length } });
  return lines.join('\n') + '\n';
}
