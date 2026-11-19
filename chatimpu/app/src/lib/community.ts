/**
 * Help centre, Reporter Academy, corrections, grievances, local info and community board
 * (supabase/migrations/0009_community.sql). In demo mode (no backend) the help content comes from the
 * bundled copy of the same seed rows (data/helpSeed.json) and nothing is sent anywhere.
 */
import { supabase, mediaUrl } from './supabase';
import seed from '@/data/helpSeed.json';

export interface Faq { id: string; audience: 'reporter' | 'reader'; category: string; category_te: string | null; question_te: string; answer_te: string; question_en: string; answer_en: string; sort: number }
export interface QuizQ { q_te: string; q_en: string; options: { te: string; en: string }[] }
export interface Lesson { id: string; sort: number; title_te: string; title_en: string; body_te: string; body_en: string; quiz: QuizQ[] }
export interface QuizResult { score: number; total: number; passed: boolean; wrong: number[]; completed: number; lessons: number }
export interface Contact { id: string; kind: string; name_te: string; name_en: string; phone: string; address?: string | null; district_id?: string | null }
export interface Price { item: string; price_paise: number; unit: string; price_date: string; source: string; previous_paise: number | null }
export type PostKind = 'obituary' | 'wishes' | 'job' | 'buy_sell' | 'lost_found' | 'event' | 'announcement';
export interface CommunityPost { id: string; code: string; kind: PostKind; district_id: string; title: string; body: string; photo: string | null; contact_phone: string | null; price_paise: number | null; event_at: string | null; status: string; reject_reason: string | null; created_at: string; mine?: boolean }
export interface Officer { name: string; email: string; phone: string; address: string }

const ok = <T,>(r: { data: T | null; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };
const need = () => { if (!supabase) throw new Error('This needs the Chatimpu backend (demo mode).'); return supabase; };
const demoLessons = seed.lessons as (Omit<Lesson, 'quiz'> & { quiz: (QuizQ & { answer: number })[] })[];

export async function loadFaqs(audience: Faq['audience']): Promise<Faq[]> {
  if (supabase) {
    const { data, error } = await supabase.from('faqs').select('*').eq('audience', audience).eq('active', true).order('sort');
    if (!error && data) return data as Faq[];
  }
  return (seed.faqs as Faq[]).filter((f) => f.audience === audience);
}

export async function loadLessons(): Promise<Lesson[]> {
  if (supabase) {
    const { data, error } = await supabase.from('academy_public').select('*').order('sort');
    if (!error && data) return data as Lesson[];
  }
  return demoLessons.map((l) => ({ ...l, quiz: l.quiz.map(({ answer: _a, ...q }) => q) }));
}

const demoPassed = new Set<string>();
export async function academyProgress(): Promise<{ lessons: number; passed: number; passed_ids: string[] }> {
  if (supabase && (await supabase.auth.getSession()).data.session) {
    const r = ok(await supabase.rpc('academy_status', {})) as { lessons: number; passed: number; passed_ids: string[] } | null;
    if (r) return r;
  }
  return { lessons: demoLessons.length, passed: demoPassed.size, passed_ids: [...demoPassed] };
}

/** Marked on the server; the app never holds the answers (demo mode marks against the bundled copy). */
export async function submitQuiz(lessonId: string, answers: number[]): Promise<QuizResult> {
  if (supabase) return ok(await supabase.rpc('submit_lesson_quiz', { p_lesson: lessonId, p_answers: answers })) as QuizResult;
  const l = demoLessons.find((x) => x.id === lessonId)!;
  const wrong = l.quiz.map((q, i) => (answers[i] === q.answer ? 0 : i + 1)).filter(Boolean);
  if (!wrong.length) demoPassed.add(lessonId);
  return { score: l.quiz.length - wrong.length, total: l.quiz.length, passed: !wrong.length, wrong, completed: demoPassed.size, lessons: demoLessons.length };
}

export type FlagReason = 'wrong_facts' | 'misleading' | 'offensive' | 'privacy' | 'copyright' | 'duplicate' | 'other';
export async function flagStory(storyId: string, reason: FlagReason, details: string) {
  ok(await need().rpc('flag_story', { p_story: storyId, p_reason: reason, p_details: details }));
}

export type GrievanceCategory = 'content' | 'defamation' | 'privacy' | 'copyright' | 'reporter_conduct' | 'other';
export async function submitGrievance(g: { name: string; contact: string; category: GrievanceCategory; details: string; storyId?: string | null }) {
  return ok(await need().rpc('submit_grievance', { p_name: g.name, p_contact: g.contact, p_category: g.category, p_details: g.details, p_story: g.storyId ?? null })) as { code: string; ack_due_at: string; resolve_due_at: string };
}
export async function myGrievances() {
  if (!supabase) return [];
  const { data } = await supabase.from('grievances').select('code, category, status, created_at, resolution, ack_due_at, resolve_due_at').order('created_at', { ascending: false });
  return (data ?? []) as { code: string; category: string; status: string; created_at: string; resolution: string | null; resolve_due_at: string }[];
}
export async function grievanceOfficer(): Promise<Officer | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'grievance_officer').maybeSingle();
  const v = data?.value as Officer | undefined;
  return v && v.name ? v : null;
}

export async function loadContacts(districtId: string): Promise<Contact[]> {
  if (supabase) {
    const { data, error } = await supabase.from('local_contacts').select('id, kind, name_te, name_en, phone, address, district_id')
      .eq('active', true).or(`district_id.is.null,district_id.eq.${districtId}`).order('sort');
    if (!error && data) return data as Contact[];
  }
  return seed.contacts as Contact[];
}

/** Prices are entered by editors with a source; nothing is shown when none was entered (never invented). */
export async function loadPrices(districtId: string): Promise<Price[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('latest_prices', { p_district: districtId });
  return error ? [] : (data as Price[]);
}

export async function loadCommunity(districtId: string, kind: PostKind | 'all'): Promise<CommunityPost[]> {
  if (!supabase) return [];
  const uid = (await supabase.auth.getSession()).data.session?.user.id;
  let q = supabase.from('community_posts').select('id, code, kind, district_id, title, body, photo_path, contact_phone, price_paise, event_at, status, reject_reason, created_at, created_by')
    .eq('district_id', districtId).order('created_at', { ascending: false }).limit(100);
  if (kind !== 'all') q = q.eq('kind', kind);
  const rows = ok(await q) as (Omit<CommunityPost, 'photo'> & { photo_path: string | null; created_by: string })[];
  return rows.map(({ photo_path, created_by, ...r }) => ({ ...r, photo: photo_path ? mediaUrl(photo_path) : null, mine: created_by === uid }));
}

export async function postCommunity(p: { kind: PostKind; district_id: string; mandal_id?: string | null; lang: string; title: string; body: string; contact_phone?: string | null; price_paise?: number | null; event_at?: string | null; consent_confirmed: boolean }) {
  return ok(await need().from('community_posts').insert(p).select('code').single()) as { code: string };
}

export const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** kind, Telugu, English, icon */
export const POST_KINDS: [PostKind, string, string, 'flower' | 'gift' | 'briefcase' | 'pricetag' | 'search' | 'calendar' | 'megaphone'][] = [
  ['obituary', 'శ్రద్ధాంజలి', 'Obituary', 'flower'], ['wishes', 'శుభాకాంక్షలు', 'Wishes', 'gift'], ['job', 'ఉద్యోగాలు', 'Jobs', 'briefcase'],
  ['buy_sell', 'కొనుగోలు/అమ్మకం', 'Buy & sell', 'pricetag'], ['lost_found', 'పోయినవి/దొరికినవి', 'Lost & found', 'search'],
  ['event', 'కార్యక్రమాలు', 'Events', 'calendar'], ['announcement', 'ప్రకటనలు', 'Announcements', 'megaphone'],
];

