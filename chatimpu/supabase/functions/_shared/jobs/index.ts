/**
 * Scheduled jobs shared by the notify-dispatch and maintenance Edge Functions (and the tests).
 * Plain TypeScript with an injected Supabase client and fetch, so it runs under Deno and Node alike.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface Claimed { id: string; user_id: string; kind: string; title_en: string; title_te: string | null; body_en: string | null; body_te: string | null; link: string | null }
interface Token { token: string; user_id: string; language: string | null }
interface Ticket { status: 'ok' | 'error'; message?: string; details?: { error?: string } }

/** Channel per notification kind (Android channels are created by the app). */
const channelFor = (kind: string) => (['payment', 'payment_failed', 'withdrawal', 'earning', 'withdrawal_eligible', 'payout_method'].includes(kind) ? 'account' : 'local');

/**
 * Claims a batch of undelivered notifications (atomically, so overlapping runs never double-send),
 * sends them through Expo, and removes tokens Expo reports as no longer registered.
 */
export async function dispatchPushes(db: SupabaseClient, fetchImpl: typeof fetch = fetch, opts: { batch?: number; url?: string } = {}) {
  const { data, error } = await db.rpc('claim_push_batch', { p_limit: opts.batch ?? 200 });
  if (error) throw new Error(error.message);
  const items = (data ?? []) as Claimed[];
  if (!items.length) return { notifications: 0, pushes: 0, failed: 0, tokensRemoved: 0 };

  const userIds = [...new Set(items.map((n) => n.user_id))];
  const t = await db.from('push_tokens').select('token, user_id, language').in('user_id', userIds);
  if (t.error) throw new Error(t.error.message);
  const tokens = (t.data ?? []) as Token[];

  const messages = items.flatMap((n) => tokens.filter((x) => x.user_id === n.user_id).map((x) => {
    const te = x.language === 'te';
    return {
      to: x.token,
      title: te && n.title_te ? n.title_te : n.title_en,
      body: (te && n.body_te ? n.body_te : n.body_en) ?? undefined,
      // In-app routes mirror the portal paths (/reporter/…, /story/…), so the same link opens the right screen.
      data: { url: n.link ? `chatimpu://${n.link.replace(/^\/+/, '')}` : undefined, kind: n.kind, notificationId: n.id },
      channelId: channelFor(n.kind),
      sound: 'default',
    };
  }));

  let failed = 0; const dead = new Set<string>();
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetchImpl(opts.url ?? EXPO_PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(chunk) });
      if (!res.ok) { failed += chunk.length; continue; }
      const tickets = ((await res.json()) as { data?: Ticket[] }).data ?? [];
      tickets.forEach((tk, j) => {
        if (tk.status !== 'error') return;
        failed++;
        if (tk.details?.error === 'DeviceNotRegistered') dead.add(chunk[j].to);
      });
    } catch {
      failed += chunk.length;
    }
  }
  if (dead.size) await db.from('push_tokens').delete().in('token', [...dead]);
  // Every claimed notification stays in the app inbox even if a push failed; we do not retry pushes
  // (a late duplicate is worse than a missed banner for account messages that are visible in-app).
  return { notifications: items.length, pushes: messages.length, failed, tokensRemoved: dead.size };
}

export interface MaintenanceResult {
  notifications_read_deleted: number; notifications_unread_deleted: number; webhook_payloads_cleared: number; drafts_warned: number;
  id_documents_purged: number; drafts_deleted: number; files_removed: number; errors: string[];
}

/** Daily data-retention sweep: DB-only parts in SQL, files through the Storage API. */
export async function runMaintenance(db: SupabaseClient): Promise<MaintenanceResult> {
  const sql = await db.rpc('retention_sweep_sql');
  if (sql.error) throw new Error(sql.error.message);
  const cand = await db.rpc('retention_file_candidates', { p_limit: 200 });
  if (cand.error) throw new Error(cand.error.message);
  const { id_documents: docs, drafts } = cand.data as { id_documents: { id: string; path: string }[]; drafts: { id: string; media: { bucket: string; path: string }[] }[] };

  let idDocs = 0, draftRows = 0, files = 0; const errors: string[] = [];
  if (docs.length) {
    const rm = await db.storage.from('reporter-private').remove(docs.map((d) => d.path));
    if (rm.error) errors.push(`id documents: ${rm.error.message}`);
    else {
      files += rm.data?.length ?? 0;
      const done = await db.rpc('retention_id_documents_done', { p_ids: docs.map((d) => d.id) });
      if (done.error) errors.push(done.error.message); else idDocs = done.data as number;
    }
  }
  if (drafts.length) {
    const byBucket = new Map<string, string[]>();
    for (const d of drafts) for (const m of d.media) byBucket.set(m.bucket, [...(byBucket.get(m.bucket) ?? []), m.path]);
    let ok = true;
    for (const [bucket, paths] of byBucket) {
      const rm = await db.storage.from(bucket).remove(paths);
      if (rm.error) { ok = false; errors.push(`drafts (${bucket}): ${rm.error.message}`); } else files += rm.data?.length ?? 0;
    }
    if (ok) {
      const done = await db.rpc('retention_drafts_done', { p_ids: drafts.map((d) => d.id) });
      if (done.error) errors.push(done.error.message); else draftRows = done.data as number;
    }
  }
  const swept = sql.data as Pick<MaintenanceResult, 'notifications_read_deleted' | 'notifications_unread_deleted' | 'webhook_payloads_cleared' | 'drafts_warned'>;
  return { ...swept, id_documents_purged: idDocs, drafts_deleted: draftRows, files_removed: files, errors };
}
