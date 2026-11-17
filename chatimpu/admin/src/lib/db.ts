/**
 * Supabase data access for the CMS. Every call runs as the signed-in staff member, so
 * row-level security (supabase/migrations/0002_rls.sql + 0004_cms.sql) decides what each
 * role may read and change; these functions only map rows <-> the shared app types.
 */
import type { Ad, CategoryId, CitizenSubmission, ContentLang, Poll, Role, StoryText } from '@data/types';
import { supabase, supabaseUrl } from './supabase';
import type { CmsStory, CmsUser, DailyStat, DistrictStat, Session } from './store';

const db = () => {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
};

/** Throws on error; list queries return [] rather than null. `maybeSingle()` callers still null-check. */
function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
}

/** Storage path → public URL. Full URLs (and local blob: previews) pass through. */
export const mediaUrl = (p?: string | null) =>
  !p ? '' : /^(https?:|blob:|data:)/.test(p) ? p : `${supabaseUrl}/storage/v1/object/public/media/${p.replace(/^\/+/, '')}`;

// ── Session ───────────────────────────────────────────────────────────────────
export async function loadSession(userId: string): Promise<Session & { userId: string; isStaff: boolean }> {
  const { data: profile, error } = await db().from('profiles').select('id, display_name, phone, role').eq('id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  const role = (profile?.role ?? 'reader') as Role | 'reader';
  const districts = role === 'reader' ? [] : check(await db().from('moderator_districts').select('district_id').eq('user_id', userId)).map((r) => r.district_id as string);
  const granted = check(await db().from('staff_permissions').select('permission').eq('user_id', userId)).map((r) => r.permission as string);
  const permissions = role === 'super_admin' ? ['finance', 'reporter_admin'] : granted;
  return {
    userId,
    name: profile?.display_name || (profile?.phone ? `+${profile.phone}` : 'Staff'),
    role: (role === 'reader' ? 'reporter' : role) as Role,
    // Super admins and editors work across all districts.
    districts: role === 'district_moderator' || role === 'reporter' ? districts : [],
    permissions,
    staffRole: role !== 'reader',
    // Finance-only accounts (no newsroom role) may enter the CMS to reach the finance desk.
    isStaff: role !== 'reader' || permissions.length > 0,
  };
}

// ── Stories ───────────────────────────────────────────────────────────────────
type StoryDoc = Omit<CmsStory, 'image'> & { image: string; imagePath: string };

const toStory = (d: StoryDoc): CmsStory => ({
  ...d,
  lat: d.lat ?? 0,
  lng: d.lng ?? 0,
  content: d.content ?? { en: { headline: '', summary: '' } },
  reactions: d.reactions ?? { like: 0, wow: 0, sad: 0, angry: 0 },
  image: mediaUrl(d.imagePath ?? d.image),
  imagePath: d.imagePath,
  villageId: d.villageId ?? undefined,
  sponsor: d.sponsor ?? undefined,
  publishAt: d.publishAt ?? undefined,
  pushOnPublish: !!d.pushOnPublish,
  author: d.author ?? '',
});

export async function loadStories(): Promise<CmsStory[]> {
  const rows = check(await db().from('cms_stories').select('doc').order('updated_at', { ascending: false }).limit(500));
  return rows.map((r) => toStory(r.doc as StoryDoc));
}

async function loadStory(id: string): Promise<CmsStory> {
  const row = check(await db().from('cms_stories').select('doc').eq('id', id).single()) as { doc: StoryDoc };
  return toStory(row.doc);
}

async function uploadImage(file: File, folder: string, id: string) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${folder}/${id}-${Date.now()}.${ext}`;
  check(await db().storage.from('media').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false }));
  return path;
}

export async function saveStory(s: CmsStory, opts: { isNew: boolean; wasPublished: boolean; userId: string; imageFile?: File | null }): Promise<CmsStory> {
  let imagePath = s.imagePath ?? s.image;
  if (opts.imageFile) imagePath = await uploadImage(opts.imageFile, 'stories', s.id);
  if (!imagePath || imagePath.startsWith('blob:')) throw new Error('Add an image before saving');

  const nowPublished = s.status === 'published';
  const row: Record<string, unknown> = {
    id: s.id,
    category_id: s.category,
    state_id: s.stateId,
    district_id: s.districtId,
    mandal_id: s.mandalId,
    village_id: s.villageId ?? null,
    geo: `SRID=4326;POINT(${s.lng} ${s.lat})`,
    image_path: imagePath,
    source: s.source,
    status: s.status,
    publish_at: s.status === 'scheduled' ? s.publishAt ?? null : null,
    published_at: nowPublished ? (opts.wasPublished ? s.publishedAt : new Date().toISOString()) : null,
    is_breaking: !!s.isBreaking,
    push_on_publish: s.pushOnPublish,
    sponsor: s.sponsor?.trim() || null,
  };
  if (opts.isNew) row.author_id = opts.userId;
  check(await db().from('stories').upsert(row, { onConflict: 'id' }));

  const translations = Object.entries(s.content as Record<string, StoryText | undefined>)
    .filter(([, t]) => t && t.headline.trim() && t.summary.trim())
    .map(([lang, t]) => ({ story_id: s.id, lang, headline: t!.headline.trim(), summary: t!.summary.trim() }));
  if (translations.length) check(await db().from('story_translations').upsert(translations, { onConflict: 'story_id,lang' }));

  if (nowPublished && !opts.wasPublished && s.pushOnPublish) {
    // Best effort: a push failure must not undo the publish.
    await db().functions.invoke('send-push', { body: { storyId: s.id, kind: s.isBreaking ? 'breaking' : 'local' } }).catch(() => undefined);
  }
  return loadStory(s.id);
}

export async function deleteStory(id: string) {
  check(await db().from('stories').delete().eq('id', id));
}

// ── Citizen reports ───────────────────────────────────────────────────────────
interface ReportRow {
  id: string; headline: string; body: string; lang: ContentLang; category_id: CategoryId; district_id: string; mandal_id: string | null;
  media: string[]; status: string; ai_flags: string[]; submitted_at: string;
  reporter: { display_name: string | null; phone: string | null; verified_reporter: boolean } | null;
}

export async function loadSubmissions(): Promise<CitizenSubmission[]> {
  const rows = check(await db().from('citizen_reports')
    .select('id, headline, body, lang, category_id, district_id, mandal_id, media, status, ai_flags, submitted_at, reporter:profiles!citizen_reports_reporter_id_fkey(display_name, phone, verified_reporter)')
    .not('status', 'in', '(draft,correction_required)')
    .order('submitted_at', { ascending: false }).limit(300)) as unknown as ReportRow[];
  // The editorial workflow (0005) has more states than the legacy queue; fold them for the dashboard/badge.
  const legacy = (s: string): CitizenSubmission['status'] => (s === 'approved' || s === 'published' ? 'approved' : s === 'rejected' ? 'rejected' : 'pending');
  return rows.map((r) => ({
    id: r.id, headline: r.headline, body: r.body, lang: r.lang, category: r.category_id, districtId: r.district_id, mandalId: r.mandal_id ?? '',
    media: (r.media ?? []).map(mediaUrl), status: legacy(r.status), aiFlags: r.ai_flags ?? [], submittedAt: r.submitted_at,
    reporterName: r.reporter?.display_name || 'Citizen reporter',
    reporterPhone: r.reporter?.phone ? `+${r.reporter.phone.slice(0, 7)}xxxxx` : '',
    verified: !!r.reporter?.verified_reporter,
  }));
}

/** Publishes the (possibly edited) report as a story; returns the new story. */
export async function approveSubmission(id: string, headline: string, summary: string): Promise<CmsStory> {
  const storyId = check(await db().rpc('approve_report', { p_report: id, p_headline: headline, p_summary: summary, p_image_path: null })) as string;
  return loadStory(storyId);
}

export async function rejectSubmission(id: string, userId: string, note?: string) {
  void userId; // the reviewer is recorded server-side from the session
  check(await db().rpc('editorial_set_status', { p_id: id, p_status: 'rejected', p_note: note?.trim() || 'Not suitable for publication' }));
}

// ── Ads ───────────────────────────────────────────────────────────────────────
interface AdRow {
  id: string; district_ids: string[] | null; image_path: string; headline: Ad['headline']; body: Ad['body']; cta: Ad['cta']; url: string;
  status: Ad['status']; budget_inr: number; impressions: number; clicks: number; advertisers: { name: string; phone: string | null } | null;
}

export async function loadAds(): Promise<Ad[]> {
  const rows = check(await db().from('ads').select('id, district_ids, image_path, headline, body, cta, url, status, budget_inr, impressions, clicks, advertisers(name, phone)').order('starts_at', { ascending: false })) as unknown as AdRow[];
  return rows.map((a) => ({
    id: a.id, advertiser: a.advertisers?.name ?? '', phone: a.advertisers?.phone ?? undefined, districtIds: a.district_ids ?? 'all',
    image: mediaUrl(a.image_path), headline: a.headline, body: a.body, cta: a.cta, url: a.url, status: a.status,
    budgetInr: a.budget_inr, impressions: a.impressions, clicks: a.clicks,
  }));
}

export async function saveAd(a: Ad) {
  let advertiserId: string | null = null;
  if (a.advertiser.trim()) {
    const found = check(await db().from('advertisers').select('id').eq('name', a.advertiser.trim()).limit(1));
    advertiserId = found[0]?.id ?? (check(await db().from('advertisers').insert({ name: a.advertiser.trim(), phone: a.phone ?? null }).select('id').single()) as { id: string }).id;
  }
  check(await db().from('ads').upsert({
    id: a.id, advertiser_id: advertiserId, district_ids: a.districtIds === 'all' ? null : a.districtIds,
    image_path: a.image || 'ads/placeholder.jpg', headline: a.headline, body: a.body, cta: a.cta, url: a.url || '#',
    status: a.status, budget_inr: a.budgetInr,
  }, { onConflict: 'id' }));
}

// ── Polls ─────────────────────────────────────────────────────────────────────
export async function loadPolls(): Promise<Poll[]> {
  return (check(await db().rpc('get_polls_with_results')) ?? []) as Poll[];
}

export async function createPoll(p: Poll) {
  check(await db().from('polls').insert({ id: p.id, category_id: p.category, closes_at: p.closesAt }));
  check(await db().from('poll_questions').insert(Object.entries(p.question).map(([lang, question]) => ({ poll_id: p.id, lang, question }))));
  check(await db().from('poll_options').insert(p.options.map((o, i) => ({ poll_id: p.id, id: o.id, sort: i }))));
  check(await db().from('poll_option_labels').insert(p.options.flatMap((o) => Object.entries(o.label).map(([lang, label]) => ({ poll_id: p.id, option_id: o.id, lang, label })))));
}

// ── Users & roles ─────────────────────────────────────────────────────────────
export async function loadUsers(): Promise<CmsUser[]> {
  const [profiles, mods] = await Promise.all([
    db().from('profiles').select('id, display_name, phone, role, verified_reporter, created_at').order('created_at', { ascending: false }).limit(500),
    db().from('moderator_districts').select('user_id, district_id'),
  ]);
  const byUser = new Map<string, string[]>();
  for (const m of check(mods)) byUser.set(m.user_id, [...(byUser.get(m.user_id) ?? []), m.district_id]);
  return check(profiles).map((p) => ({
    id: p.id, name: p.display_name || '—', phone: p.phone ? `${p.phone.replace(/^91/, '')}` : '', role: p.role,
    districts: byUser.get(p.id) ?? [], verifiedReporter: p.verified_reporter, joined: String(p.created_at).slice(0, 10),
  }));
}

export async function updateUser(id: string, patch: Partial<CmsUser>) {
  const row: Record<string, unknown> = {};
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.verifiedReporter !== undefined) row.verified_reporter = patch.verifiedReporter;
  if (patch.name !== undefined) row.display_name = patch.name;
  if (Object.keys(row).length) check(await db().from('profiles').update(row).eq('id', id));
  if (patch.districts) {
    check(await db().from('moderator_districts').delete().eq('user_id', id));
    if (patch.districts.length) check(await db().from('moderator_districts').insert(patch.districts.map((d) => ({ user_id: id, district_id: d }))));
  }
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export async function loadAnalytics(days = 14): Promise<{ daily: DailyStat[]; districts: DistrictStat[] }> {
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const [daily, retention, district] = await Promise.all([
    db().from('analytics_daily').select('day, views, flips, shares, readers').gte('day', since),
    db().from('analytics_retention').select('district_id, d0, cohort, d7'),
    db().from('analytics_district').select('district_id, views, flips, shares, readers'),
  ]);
  const byDay = new Map<string, DailyStat>();
  for (let i = 0; i < days; i++) {
    const day = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    byDay.set(day, { day, views: 0, flips: 0, shares: 0, dau: 0, retentionD7: 0 });
  }
  for (const r of check(daily)) {
    const d = byDay.get(String(r.day).slice(0, 10));
    if (d) { d.views += r.views; d.flips += r.flips; d.shares += r.shares; d.dau += r.readers; }
  }
  const ret = check(retention);
  for (const d of byDay.values()) {
    // D7 retention of the cohort that started 7 days before this day
    const d0 = new Date(new Date(d.day).getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
    const rows = ret.filter((r) => String(r.d0).slice(0, 10) === d0);
    const cohort = rows.reduce((a, r) => a + r.cohort, 0);
    d.retentionD7 = cohort ? rows.reduce((a, r) => a + r.d7, 0) / cohort : 0;
  }
  const districts = check(district).map((r) => {
    const rows = ret.filter((x) => x.district_id === r.district_id);
    const cohort = rows.reduce((a, x) => a + x.cohort, 0);
    return { districtId: r.district_id, views: r.views, flips: r.flips, shares: r.shares, readers: r.readers, retention: cohort ? rows.reduce((a, x) => a + x.d7, 0) / cohort : 0 };
  }).sort((a, b) => b.views - a.views);
  return { daily: [...byDay.values()], districts };
}

// ── Settings ──────────────────────────────────────────────────────────────────
export async function loadAdFrequency(): Promise<number> {
  const { data, error } = await db().from('app_settings').select('value').eq('key', 'ad_frequency').maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.value ?? 8) || 8;
}

export async function saveAdFrequency(n: number) {
  check(await db().from('app_settings').upsert({ key: 'ad_frequency', value: n, updated_at: new Date().toISOString() }));
}
