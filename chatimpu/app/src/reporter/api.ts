/**
 * Reporter hub data access for the mobile app — the same Supabase RPCs, tables and Edge Functions as
 * the web reporter portal (admin/src/reporter/api.ts). Row-level security limits each reporter to their
 * own rows; money only moves through the ledger functions in supabase/migrations/0005–0007.
 */
import { supabase } from '@/lib/supabase';

export const db = () => {
  if (!supabase) throw new Error('The reporter hub needs the Chatimpu backend.');
  return supabase;
};
export function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
async function fnError(error: unknown) {
  const ctx = (error as { context?: Response }).context;
  return (await ctx?.json?.().catch(() => null))?.error ?? (error as Error).message;
}

export type ReporterStatus = 'registered' | 'verification_pending' | 'verified' | 'active' | 'suspended' | 'rejected';
export interface ReporterProfile { user_id: string; full_name: string; email: string | null; district_id: string; mandal_id: string | null; locality: string | null; preferred_language: string; interests: string[]; intro: string | null; category: string; status: ReporterStatus; status_reason: string | null }
export interface Dashboard {
  profile: ReporterProfile | null; verified_identity: boolean; level: string;
  counts: { total: number; drafts: number; under_review: number; correction_required: number; approved: number; rejected: number };
  wallet: { available_paise: number; reserved_paise: number; paid_paise: number; lifetime_earned_paise: number };
  pending_earnings_paise: number; threshold_paise: number; rank: number | null; unread: number;
  badges: { code: string; name_en: string; name_te: string; icon: string }[];
}
export interface Submission { id: string; code: string | null; headline: string; body: string; status: string; submission_type: string; category_id: string; lang: string; district_id: string; mandal_id: string | null; locality: string | null; incident_location: string | null; source_notes: string | null; assignment_id: string | null; rights_confirmed: boolean; correction_note: string | null; rejection_reason: string | null; story_id: string | null; updated_at: string; submitted_at: string | null }
export interface Media { id: string; kind: string; bucket: string; storage_path: string; mime_type: string | null }
export interface Assignment { id: string; code: string; title: string; description: string; district_id: string; locality: string | null; deadline: string | null; priority: string; assigned_reporter_id: string | null; media_required: string[]; special_amount_paise: number; status: string }
export interface Rate { code: string; label_en: string; label_te: string; min_paise: number; max_paise: number; admin_defined: boolean }
export interface Method { id: string; kind: 'upi' | 'bank'; holder_name: string; masked: string; ifsc: string | null; bank_name: string | null; verification_status: string; verification_note: string | null; is_default: boolean }
export interface Withdrawal { id: string; code: string; amount_paise: number; tds_paise: number; net_paise: number | null; status: string; reason: string | null; method_snapshot: { masked?: string; kind?: string }; created_at: string; paid_at: string | null; needs_reconciliation: boolean }
export interface Earning { id: string; code: string; contribution_code: string; amount_paise: number; status: string; approved_at: string }
export interface Notification { id: string; kind: string; title_en: string; title_te: string | null; body_en: string | null; body_te: string | null; link: string | null; read_at: string | null; created_at: string }
export interface TaxSummary { fy: string; tds_enabled: boolean; rate_bps: number; rate_no_pan_bps: number; threshold_paise: number; pan: { masked: string; name: string; status: string; note: string | null } | null; fy_tds_paise: number }

export const loadDashboard = async () => ok(await db().rpc('reporter_dashboard')) as Dashboard;
export const session = async () => (await db().auth.getSession()).data.session;

export const register = async (p: { full_name: string; email: string; district: string; mandal: string; locality: string; language: string; interests: string[]; intro: string }) =>
  ok(await db().rpc('register_reporter', {
    p_full_name: p.full_name, p_email: p.email, p_district: p.district, p_mandal: p.mandal, p_locality: p.locality, p_language: p.language,
    p_interests: p.interests, p_intro: p.intro, p_photo_path: null, p_accept_agreement: true,
  })) as ReporterProfile;

/** Uploads a local file (camera / gallery URI). RN fetch gives an ArrayBuffer, which supabase-js uploads as-is. */
export async function uploadUri(bucket: string, path: string, uri: string, contentType: string) {
  const body = await (await fetch(uri)).arrayBuffer();
  if (body.byteLength > 100 * 1024 * 1024) throw new Error('File is larger than 100 MB');
  ok(await db().storage.from(bucket).upload(path, body, { contentType, upsert: false }));
  return body.byteLength;
}
export const signedUrl = async (bucket: string, path: string) => (await db().storage.from(bucket).createSignedUrl(path, 3600)).data?.signedUrl ?? null;
export const submitVerification = async (type: string, last4: string, path: string) =>
  ok(await db().rpc('submit_verification', { p_document_type: type, p_last4: last4, p_document_path: path }));
export const verifications = async () =>
  ok(await db().from('reporter_verifications').select('id, document_type, document_last4, status, review_note, created_at').order('created_at', { ascending: false })) as { id: string; document_type: string; document_last4: string | null; status: string; review_note: string | null }[];

export const listSubmissions = async () => ok(await db().from('citizen_reports').select('*').order('updated_at', { ascending: false }).limit(200)) as Submission[];
export const getSubmission = async (id: string) => ok(await db().from('citizen_reports').select('*').eq('id', id).single()) as Submission;
export const listMedia = async (id: string) => ok(await db().from('submission_media').select('id, kind, bucket, storage_path, mime_type').eq('submission_id', id).order('created_at')) as Media[];
export const history = async (id: string) =>
  ok(await db().from('editorial_reviews').select('id, action, to_status, note, created_at').eq('submission_id', id).order('id')) as { id: number; action: string; to_status: string; note: string | null; created_at: string }[];
export async function saveSubmission(id: string | null, fields: Partial<Submission>) {
  if (id) return ok(await db().from('citizen_reports').update(fields).eq('id', id).select('*').single()) as Submission;
  return ok(await db().from('citizen_reports').insert({ ...fields, status: 'draft' }).select('*').single()) as Submission;
}
export const sendForReview = async (id: string) => ok(await db().from('citizen_reports').update({ status: 'submitted' }).eq('id', id).select('*').single()) as Submission;
export const addMedia = async (row: { submission_id: string; kind: string; storage_path: string; mime_type: string; size_bytes: number }) =>
  ok(await db().from('submission_media').insert({ ...row, bucket: 'submissions' }).select('id, kind, bucket, storage_path, mime_type').single()) as Media;
export const removeMedia = async (m: Media) => { ok(await db().from('submission_media').delete().eq('id', m.id)); await db().storage.from(m.bucket).remove([m.storage_path]); };

export const listAssignments = async () => ok(await db().from('reporter_assignments').select('*').order('deadline', { ascending: true, nullsFirst: false })) as Assignment[];
export const acceptAssignment = async (id: string) => ok(await db().rpc('accept_assignment', { p_id: id }));

export const rates = async () => ok(await db().from('contribution_rates').select('code, label_en, label_te, min_paise, max_paise, admin_defined').eq('active', true).order('sort')) as Rate[];
export const earnings = async () => ok(await db().from('reporter_earnings').select('id, code, contribution_code, amount_paise, status, approved_at').order('approved_at', { ascending: false }).limit(100)) as Earning[];
export const methods = async () => ok(await db().from('payout_methods').select('id, kind, holder_name, masked, ifsc, bank_name, verification_status, verification_note, is_default').eq('active', true).order('created_at')) as Method[];
export const withdrawals = async () => ok(await db().from('withdrawal_requests').select('id, code, amount_paise, tds_paise, net_paise, status, reason, method_snapshot, created_at, paid_at, needs_reconciliation').order('created_at', { ascending: false })) as Withdrawal[];
export const utrFor = async (id: string) => (ok(await db().from('payment_transactions').select('utr').eq('withdrawal_id', id).not('utr', 'is', null).limit(1)) as { utr: string }[])[0]?.utr ?? null;
export const requestWithdrawal = async (paise: number, method: string) => ok(await db().rpc('request_withdrawal', { p_amount_paise: paise, p_method: method })) as Withdrawal;
export const cancelWithdrawal = async (id: string) => ok(await db().rpc('cancel_withdrawal', { p_id: id }));
export const removeMethod = async (id: string) => ok(await db().rpc('deactivate_payout_method', { p_id: id }));
export async function addMethod(body: Record<string, unknown>) {
  const { data, error } = await db().functions.invoke('payout-methods', { body: { action: 'add', ...body } });
  if (error) throw new Error(await fnError(error));
  return data.method as Method;
}
export const taxSummary = async () => ok(await db().rpc('my_tax_summary')) as TaxSummary;
export async function addPan(pan: string, name: string) {
  const { data, error } = await db().functions.invoke('payout-methods', { body: { action: 'tax-profile', pan, name } });
  if (error) throw new Error(await fnError(error));
  return data.taxProfile as { pan_masked: string };
}
export const notifications = async () => ok(await db().from('notifications').select('*').order('created_at', { ascending: false }).limit(100)) as Notification[];
export const markAllRead = async () => ok(await db().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null));

export const rupees = (p: number | null | undefined) =>
  `₹${((p ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: (p ?? 0) % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const safeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(-60) || 'file';
