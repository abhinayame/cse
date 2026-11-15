/**
 * Data service. Talks to Supabase when EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are set,
 * otherwise serves the bundled sample data (demo mode) with realistic latency so
 * loading skeletons and offline fallbacks can be exercised.
 */
import { STORIES } from '@/data/stories';
import { ADS, ALERTS, MAGAZINES, POLLS, VIDEOS } from '@/data/catalog';
import type { Ad, CategoryId, CitizenSubmission, ContentLang, LocalAlert, Magazine, Poll, Story, VideoStory } from '@/data/types';
import { supabase } from './supabase';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FeedQuery { lang: string; districtId: string; mandalId: string; stateId: string; limit?: number }

export async function fetchStories(q: FeedQuery): Promise<Story[]> {
  if (supabase) {
    const { data, error } = await supabase.rpc('get_feed', {
      p_lang: q.lang, p_district: q.districtId, p_mandal: q.mandalId, p_limit: q.limit ?? 100,
    });
    if (error) throw error;
    return data as Story[];
  }
  await delay(650);
  return STORIES;
}

export async function fetchVideos(): Promise<VideoStory[]> {
  if (supabase) {
    const { data, error } = await supabase.from('video_feed').select('*').limit(30);
    if (error) throw error;
    return data as VideoStory[];
  }
  await delay(300);
  return VIDEOS;
}

export async function fetchPolls(): Promise<Poll[]> {
  if (supabase) {
    const { data, error } = await supabase.rpc('get_polls_with_results');
    if (error) throw error;
    return data as Poll[];
  }
  await delay(200);
  return POLLS;
}

export async function votePoll(pollId: string, optionId: string, districtId: string) {
  if (supabase) {
    const { error } = await supabase.rpc('cast_vote', { p_poll: pollId, p_option: optionId, p_district: districtId });
    if (error) throw error;
  }
}

export async function fetchAlerts(districtId: string): Promise<LocalAlert[]> {
  if (supabase) {
    const { data, error } = await supabase.from('local_alerts').select('*').eq('district_id', districtId);
    if (error) throw error;
    return data as LocalAlert[];
  }
  return ALERTS.filter((a) => a.districtId === districtId);
}

export const fetchMagazines = async (): Promise<Magazine[]> => MAGAZINES;

export function adsFor(districtId: string): Ad[] {
  return ADS.filter((a) => a.status === 'active' && (a.districtIds === 'all' || a.districtIds.includes(districtId)));
}

export interface SearchFilters { q: string; districtId?: string; category?: CategoryId; sinceHours?: number; lang?: ContentLang }

/** Search — Meilisearch/Algolia in production (see backend/search), local fuzzy match in demo. */
export async function searchStories(f: SearchFilters, pool: Story[] = STORIES): Promise<Story[]> {
  const q = f.q.trim().toLowerCase();
  const now = Date.now();
  return pool.filter((s) => {
    if (f.districtId && s.districtId !== f.districtId) return false;
    if (f.category && s.category !== f.category) return false;
    if (f.sinceHours && now - new Date(s.publishedAt).getTime() > f.sinceHours * 3_600_000) return false;
    if (f.lang && !s.content[f.lang]) return false;
    if (!q) return true;
    const hay = Object.values(s.content).map((c) => `${c!.headline} ${c!.summary}`).join(' ').toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
}

// ── Auth (phone OTP) ────────────────────────────────────────────
export const DEMO_OTP = '123456';

export async function sendOtp(phone: string) {
  if (supabase) {
    const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` });
    if (error) throw error;
    return;
  }
  await delay(700);
}

export async function verifyOtp(phone: string, token: string) {
  if (supabase) {
    const { data, error } = await supabase.auth.verifyOtp({ phone: `+91${phone}`, token, type: 'sms' });
    if (error) throw error;
    return { id: data.user!.id, phone, verified: false };
  }
  await delay(600);
  if (token !== DEMO_OTP) throw new Error('Invalid code. In demo mode use 123456.');
  return { id: `demo-${phone}`, phone, verified: true };
}

// ── Citizen reporter ────────────────────────────────────────────
export type NewSubmission = Omit<CitizenSubmission, 'id' | 'submittedAt' | 'status' | 'verified' | 'reporterName' | 'reporterPhone'>;

export async function submitCitizenReport(s: NewSubmission): Promise<{ id: string }> {
  if (supabase) {
    const media: string[] = [];
    for (const uri of s.media) {
      const blob = await (await fetch(uri)).blob();
      const path = `citizen/${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { error } = await supabase.storage.from('media').upload(path, blob);
      if (error) throw error;
      media.push(path);
    }
    const { data, error } = await supabase.from('citizen_reports').insert({
      headline: s.headline, body: s.body, lang: s.lang, category_id: s.category,
      district_id: s.districtId, mandal_id: s.mandalId, media,
    }).select('id').single();
    if (error) throw error;
    return data as { id: string };
  }
  await delay(900);
  return { id: `sub-${Date.now()}` };
}
