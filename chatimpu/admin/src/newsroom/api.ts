/**
 * Newsroom (CMS) access to the reporter ecosystem: editorial workflow, reporters, assignments,
 * recognition and the finance desk. Every call runs as the signed-in staff member; the SQL
 * functions in migrations/0005_reporters.sql enforce roles and the finance permission.
 */
import { supabase } from '../lib/supabase';

export const db = () => {
  if (!supabase) throw new Error('Connect Supabase to use this module');
  return supabase;
};
export function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
}
export const rpc = async <T = unknown>(fn: string, args: Record<string, unknown> = {}) => ok(await db().rpc(fn, args)) as T;
export const paise = (p: number | null | undefined) =>
  `₹${((p ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: (p ?? 0) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

// ── Editorial ────────────────────────────────────────────────────────────────
export interface Report {
  id: string; code: string | null; reporter_id: string; headline: string; body: string; summary: string | null; status: string; submission_type: string;
  category_id: string; lang: string; district_id: string; mandal_id: string | null; locality: string | null; incident_location: string | null; incident_at: string | null;
  source_notes: string | null; assignment_id: string | null; priority: string; is_sensitive: boolean; sensitivity_reasons: string[]; human_verified: boolean;
  verification_notes: string | null; duplicate_candidates: { type: string; id: string; code?: string; headline: string; score: number }[]; ai_flags: string[];
  rights_confirmed: boolean; correction_note: string | null; rejection_reason: string | null; review_note: string | null; story_id: string | null; media: string[];
  submitted_at: string | null; updated_at: string;
}
export interface ReporterLite { user_id: string; full_name: string; status: string; category: string; district_id: string }
export interface SubMedia { id: string; kind: string; bucket: string; storage_path: string; mime_type: string | null; size_bytes: number | null; duration_sec: number | null; url?: string | null }
export interface Review { id: number; action: string; from_status: string | null; to_status: string | null; note: string | null; details: Record<string, unknown>; created_at: string; actor_id: string | null }

export const QUEUES: Record<string, string[]> = {
  review: ['submitted', 'ai_processing', 'under_review'],
  hold: ['on_hold'],
  correction: ['correction_required'],
  approved: ['approved'],
  published: ['published'],
  rejected: ['rejected'],
};

export async function loadReports(statuses: string[]) {
  return ok(await db().from('citizen_reports').select('*').in('status', statuses)
    .order('submitted_at', { ascending: true }).limit(300)) as Report[];
}
export async function reportCounts() {
  const rows = ok(await db().from('citizen_reports').select('status').neq('status', 'draft').limit(5000)) as { status: string }[];
  return Object.fromEntries(Object.entries(QUEUES).map(([k, v]) => [k, rows.filter((r) => v.includes(r.status)).length]));
}
export async function reportersByIds(ids: string[]) {
  if (!ids.length) return [] as ReporterLite[];
  return ok(await db().from('reporter_profiles').select('user_id, full_name, status, category, district_id').in('user_id', [...new Set(ids)])) as ReporterLite[];
}
export async function reportMedia(id: string) {
  const rows = ok(await db().from('submission_media').select('*').eq('submission_id', id).order('created_at')) as SubMedia[];
  return Promise.all(rows.map(async (m) => ({ ...m, url: (await db().storage.from(m.bucket).createSignedUrl(m.storage_path, 3600)).data?.signedUrl ?? null })));
}
export const reviewHistory = async (id: string) =>
  ok(await db().from('editorial_reviews').select('*').eq('submission_id', id).order('id')) as Review[];
export const setStatus = (id: string, status: string, note?: string) => rpc('editorial_set_status', { p_id: id, p_status: status, p_note: note ?? null });
export const editReport = (id: string, patch: Record<string, unknown>) => rpc('editorial_update', { p_id: id, p_patch: patch });
export const approveReport = (a: { id: string; headline: string; summary: string; contribution: string; amountPaise: number; publish: boolean; imagePath: string | null; note?: string; translations?: Record<string, { headline: string; summary: string }> }) =>
  rpc<{ story_id: string; earning: { code: string; amount_paise: number } | null }>('editorial_approve', {
    p_id: a.id, p_headline: a.headline, p_summary: a.summary, p_contribution: a.contribution, p_amount_paise: a.amountPaise, p_publish: a.publish,
    p_image_path: a.imagePath, p_note: a.note ?? null, p_translations: a.translations ?? {},
  });

/** Copies a private original into the public media bucket for use as the story cover (the original is never exposed). */
export async function promoteCover(m: SubMedia, storyKey: string) {
  const blob = ok(await db().storage.from(m.bucket).download(m.storage_path)) as Blob;
  const ext = (m.storage_path.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `stories/citizen-${storyKey}-${Date.now()}.${ext}`;
  ok(await db().storage.from('media').upload(path, blob, { contentType: m.mime_type ?? 'image/jpeg', upsert: false }));
  return path;
}

// ── Rates & settings ─────────────────────────────────────────────────────────
export interface Rate { code: string; label_en: string; label_te: string; min_paise: number; max_paise: number; admin_defined: boolean; active: boolean; sort: number }
export const loadRates = async () => ok(await db().from('contribution_rates').select('*').order('sort')) as Rate[];
export const updateRate = (r: Rate) => rpc('update_rate', { p_code: r.code, p_min: r.min_paise, p_max: r.max_paise, p_active: r.active, p_label_en: r.label_en, p_label_te: r.label_te });
export async function loadSettings(keys: string[]) {
  const rows = ok(await db().from('app_settings').select('key, value').in('key', keys)) as { key: string; value: unknown }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, unknown>;
}
export const setSetting = (key: string, value: unknown) => rpc('set_setting', { p_key: key, p_value: value });

// ── Reporters ────────────────────────────────────────────────────────────────
export interface ReporterRow {
  user_id: string; full_name: string; email: string | null; photo_path: string | null; district_id: string; mandal_id: string | null; locality: string | null;
  preferred_language: string; interests: string[]; intro: string | null; category: string; status: string; status_reason: string | null; created_at: string; reviewed_at: string | null;
}
export interface Verification { id: string; user_id: string; document_type: string; document_last4: string | null; document_path: string | null; status: string; review_note: string | null; created_at: string }
export interface NetworkRow { district_id: string; active: number; pending: number; suspended: number; submissions_30d: number; published_30d: number }
export const loadReporters = async () => ok(await db().from('reporter_profiles').select('*').order('created_at', { ascending: false }).limit(1000)) as ReporterRow[];
export const loadNetwork = () => rpc<NetworkRow[]>('reporter_network');
export const loadVerifications = async (userId: string) => ok(await db().from('reporter_verifications').select('*').eq('user_id', userId).order('created_at', { ascending: false })) as Verification[];
export const docUrl = async (path: string) => (await db().storage.from('reporter-private').createSignedUrl(path, 600)).data?.signedUrl ?? null;
export const reviewReporter = (id: string, decision: string, reason?: string, category?: string) =>
  rpc('review_reporter', { p_user: id, p_decision: decision, p_reason: reason ?? null, p_category: category ?? null });
export async function reporterStats(userId: string) {
  const rows = ok(await db().from('citizen_reports').select('status').eq('reporter_id', userId).neq('status', 'draft')) as { status: string }[];
  return { total: rows.length, published: rows.filter((r) => ['approved', 'published'].includes(r.status)).length, rejected: rows.filter((r) => r.status === 'rejected').length };
}

// ── Assignments ──────────────────────────────────────────────────────────────
export interface AssignmentRow {
  id: string; code: string; title: string; description: string; district_id: string; mandal_id: string | null; locality: string | null; deadline: string | null;
  priority: string; assigned_reporter_id: string | null; media_required: string[]; special_amount_paise: number; status: string; created_at: string; accepted_at: string | null;
}
export const loadAssignments = async () => ok(await db().from('reporter_assignments').select('*').order('created_at', { ascending: false }).limit(500)) as AssignmentRow[];
export const saveAssignment = async (a: Partial<AssignmentRow>) => {
  const row = { ...a }; delete row.code; delete row.created_at; delete row.accepted_at;
  if (row.id) return ok(await db().from('reporter_assignments').update(row).eq('id', row.id).select('*').single()) as AssignmentRow;
  delete row.id;
  return ok(await db().from('reporter_assignments').insert(row).select('*').single()) as AssignmentRow;
};

// ── Recognition ──────────────────────────────────────────────────────────────
export interface ScoreRow { reporter_id: string; name: string; district_id: string; category: string; approved: number; rejected: number; corrections: number; original_media: number; active_weeks: number; accuracy: number; score: number }
export interface Badge { code: string; name_en: string; name_te: string; description: string | null; icon: string; active: boolean }
export interface Award { id: string; reporter_id: string; badge_code: string; period: string; reason: string | null; bonus_paise: number; created_at: string }
export const loadScores = (month: string) => rpc<ScoreRow[]>('reporter_scores', { p_month: month });
export const loadBadges = async () => ok(await db().from('contributor_badges').select('*').order('code')) as Badge[];
export const loadAwards = async (month: string) => ok(await db().from('badge_awards').select('*').eq('period', month).order('created_at', { ascending: false })) as Award[];
export const awardBadge = (reporter: string, badge: string, month: string, reason: string, bonusPaise: number) =>
  rpc('award_badge', { p_reporter: reporter, p_badge: badge, p_period: month, p_reason: reason, p_bonus_paise: bonusPaise });

// ── Finance ──────────────────────────────────────────────────────────────────
export interface FinanceSummary {
  accrued_paise: number; lifetime_accrued_paise: number; liability_available_paise: number; liability_reserved_paise: number; paid_paise: number;
  withdrawals: Record<string, { count: number; amount_paise: number }> | null; needs_reconciliation: number; unverified_methods: number;
  monthly_paid: { month: string; paid_paise: number; count: number }[];
}
export interface WithdrawalRow {
  id: string; code: string; reporter_id: string; amount_paise: number; payout_method_id: string; method_snapshot: { kind?: string; masked?: string; holder_name?: string; ifsc?: string };
  status: string; reason: string | null; needs_reconciliation: boolean; reviewed_at: string | null; paid_at: string | null; created_at: string; updated_at: string;
  tds_paise: number; net_paise: number | null;
}
export interface Txn { id: string; withdrawal_id: string; provider: string; provider_mode: string; payout_mode: string | null; provider_payout_id: string | null; status: string; utr: string | null; amount_paise: number; failure_reason: string | null; created_at: string; updated_at: string }
export interface MethodRow { id: string; reporter_id: string; kind: string; holder_name: string; masked: string; ifsc: string | null; bank_name: string | null; verification_status: string; verification_note: string | null; created_at: string; active: boolean }
export interface AuditRow { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; details: Record<string, unknown>; created_at: string }

export const financeSummary = (from: string, to: string) => rpc<FinanceSummary>('finance_summary', { p_from: from, p_to: to });
export async function loadWithdrawals(f: { status?: string; from?: string; to?: string; reporterIds?: string[] }) {
  let q = db().from('withdrawal_requests').select('*').order('created_at', { ascending: false }).limit(500);
  if (f.status === 'reconcile') q = q.eq('needs_reconciliation', true);
  else if (f.status && f.status !== 'all') q = q.eq('status', f.status);
  if (f.from) q = q.gte('created_at', f.from);
  if (f.to) q = q.lte('created_at', `${f.to}T23:59:59`);
  if (f.reporterIds) q = q.in('reporter_id', f.reporterIds.length ? f.reporterIds : ['00000000-0000-0000-0000-000000000000']);
  return ok(await q) as WithdrawalRow[];
}
export const loadTxns = async (withdrawalId: string) => ok(await db().from('payment_transactions').select('*').eq('withdrawal_id', withdrawalId).order('created_at', { ascending: false })) as Txn[];
export const loadMethods = async (status: string) => {
  let q = db().from('payout_methods').select('id, reporter_id, kind, holder_name, masked, ifsc, bank_name, verification_status, verification_note, created_at, active').eq('active', true).order('created_at');
  if (status !== 'all') q = q.in('verification_status', status === 'pending' ? ['pending', 'unverified'] : [status]);
  return ok(await q) as MethodRow[];
};
export const verifyMethod = (id: string, status: 'verified' | 'failed', note?: string) => rpc('verify_payout_method', { p_id: id, p_status: status, p_note: note ?? null });
export const reviewWithdrawal = (id: string, decision: 'under_review' | 'approve' | 'reject', reason?: string) => rpc('finance_review_withdrawal', { p_id: id, p_decision: decision, p_reason: reason ?? null });
export const manualPaid = (id: string, utr: string, note?: string) => rpc('record_manual_payout', { p_id: id, p_utr: utr, p_note: note ?? null });
export const manualFailed = (id: string, status: 'failed' | 'reversed', reason: string) => rpc('record_manual_failure', { p_id: id, p_status: status, p_reason: reason });
export const ledgerCheck = () => rpc<{ reporter_id: string; field: string; wallet: number; ledger: number }[]>('ledger_check');
export const loadAudit = async () => ok(await db().from('audit_logs').select('*').order('id', { ascending: false }).limit(200)) as AuditRow[];
export async function searchReporterIds(q: string, district?: string) {
  let s = db().from('reporter_profiles').select('user_id');
  if (q.trim()) s = s.ilike('full_name', `%${q.trim().replace(/[%_]/g, '')}%`);
  if (district) s = s.eq('district_id', district);
  return (ok(await s.limit(500)) as { user_id: string }[]).map((r) => r.user_id);
}

/** Calls the `payouts` Edge Function (server-side RazorpayX / mock provider). */
export async function payouts<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().functions.invoke('payouts', { body });
  if (error) throw new Error((await (error as { context?: Response }).context?.json?.().catch(() => null))?.error ?? error.message);
  return data as T;
}
/** CSV export goes through the function so it is audited and never cached. */
export async function exportCsv(withdrawalIds?: string[]) {
  const { data: s } = await db().auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payouts`, {
    method: 'POST', headers: { Authorization: `Bearer ${s.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'export', withdrawalIds }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: `chatimpu-payouts-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Plain CSV of rows already visible on screen (no beneficiary details). */
export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Tax (TDS, PAN) — migrations/0007_tax.sql ────────────────────────────────
export interface TaxRow { reporter_id: string; name: string; district_id: string; pan_masked: string | null; pan_status: string; paid_gross_paise: number; taxable_paise: number; tds_paise: number; net_paid_paise: number; payouts: number; provisional_tds_paise: number; challans: string | null }
export interface MonthRow { month: string; payouts: number; gross_paise: number; tds_paise: number; net_paise: number; reporters: number }
export interface TaxProfile { user_id: string; pan_masked: string; name_on_pan: string; status: string; note: string | null; created_at: string }
/** Indian financial year (April–March, IST) for a date. */
export const fyOf = (d = new Date()) => {
  const ist = new Date(d.getTime() + 5.5 * 3600e3);
  const y = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
};
export const taxReport = (fy: string) => rpc<TaxRow[]>('tax_report', { p_fy: fy });
export const monthlyPayouts = (fy: string) => rpc<MonthRow[]>('payout_report_monthly', { p_fy: fy });
export const loadTaxProfiles = async (status: string) => {
  let q = db().from('reporter_tax_profiles').select('user_id, pan_masked, name_on_pan, status, note, created_at').order('created_at');
  if (status !== 'all') q = q.eq('status', status);
  return ok(await q) as TaxProfile[];
};
export const verifyTaxProfile = (user: string, status: 'verified' | 'failed', note?: string) => rpc('verify_tax_profile', { p_user: user, p_status: status, p_note: note ?? null });
export const recordChallan = (fy: string, quarter: string, challan: string) => rpc<number>('record_tds_challan', { p_fy: fy, p_quarter: quarter, p_challan: challan });
/** Form 26Q worksheet with full PANs — through the payouts function, audited, never cached. */
export async function exportTdsWorksheet(fy: string, quarter?: string) {
  const { data: s } = await db().auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/payouts`, {
    method: 'POST', headers: { Authorization: `Bearer ${s.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'tax-export', fy, quarter: quarter || undefined }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Export failed (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement('a'), { href: url, download: `chatimpu-tds-${fy}${quarter ? `-${quarter}` : ''}.csv` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
