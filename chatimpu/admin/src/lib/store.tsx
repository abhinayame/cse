/**
 * CMS state.
 *  - Demo mode (no VITE_SUPABASE_* keys): in-memory data seeded from the app's sample data
 *    (../app/src/data), with a role switcher in the sidebar.
 *  - Live mode: loaded from Supabase for the signed-in staff member; every change is written
 *    through lib/db.ts and row-level security enforces what each role may do.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORIES } from '@data/stories';
import { ADS, ANALYTICS, DISTRICT_STATS, POLLS, SUBMISSIONS } from '@data/catalog';
import { MANDALS } from '@data/locations';
import type { Ad, CitizenSubmission, Poll, Role, Story } from '@data/types';
import * as db from './db';
import { supabase } from './supabase';

export type StoryStatus = 'draft' | 'scheduled' | 'published';
export interface CmsStory extends Story { status: StoryStatus; publishAt?: string; pushOnPublish: boolean; author: string; imagePath?: string }

export interface CmsUser { id: string; name: string; phone: string; role: Role | 'reader'; districts: string[]; verifiedReporter: boolean; joined: string }
export interface DailyStat { day: string; views: number; flips: number; shares: number; dau: number; retentionD7: number }
export interface DistrictStat { districtId: string; views: number; flips: number; shares: number; retention: number; readers: number }

const DEMO_USERS: CmsUser[] = [
  { id: 'u1', name: 'Anitha Rao', phone: '98490 11223', role: 'super_admin', districts: [], verifiedReporter: true, joined: '2025-01-10' },
  { id: 'u2', name: 'Kiran Kumar', phone: '99080 22334', role: 'editor', districts: [], verifiedReporter: true, joined: '2025-02-03' },
  { id: 'u3', name: 'Swathi Reddy', phone: '90000 33445', role: 'district_moderator', districts: ['wgl'], verifiedReporter: true, joined: '2025-03-18' },
  { id: 'u4', name: 'Imran Shaik', phone: '94400 44556', role: 'district_moderator', districts: ['vsp'], verifiedReporter: true, joined: '2025-04-07' },
  { id: 'u5', name: 'Ravi Teja K.', phone: '91000 55667', role: 'reporter', districts: ['vsp'], verifiedReporter: true, joined: '2025-06-21' },
  { id: 'u6', name: 'Ayesha Fatima', phone: '97000 66778', role: 'reader', districts: [], verifiedReporter: true, joined: '2025-08-02' },
  { id: 'u7', name: 'Mahesh Goud', phone: '98480 77889', role: 'reader', districts: [], verifiedReporter: false, joined: '2025-09-30' },
];

export interface Session { name: string; role: Role; districts: string[]; userId?: string }

interface Ctx {
  live: boolean;
  loading: boolean;
  session: Session;
  /** demo mode only: switch role */
  setSession: (s: Session) => void;
  signOut: () => void;
  reload: () => void;
  stories: CmsStory[];
  saveStory: (s: CmsStory, opts: { isNew: boolean; imageFile?: File | null }) => Promise<CmsStory | null>;
  deleteStory: (id: string) => Promise<boolean>;
  submissions: CitizenSubmission[];
  approveSubmission: (id: string, headline: string, body: string) => Promise<boolean>;
  rejectSubmission: (id: string) => Promise<boolean>;
  ads: Ad[];
  upsertAd: (a: Ad) => Promise<boolean>;
  polls: Poll[];
  addPoll: (p: Poll) => Promise<boolean>;
  users: CmsUser[];
  updateUser: (id: string, patch: Partial<CmsUser>) => Promise<boolean>;
  adFrequency: number;
  setAdFrequency: (n: number) => Promise<boolean>;
  analytics: DailyStat[];
  districtStats: DistrictStat[];
  toast: (msg: string) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

const demoStories = (): CmsStory[] => STORIES.map((s, i) => ({ ...s, status: 'published', pushOnPublish: !!s.isBreaking, author: i % 3 ? 'Kiran Kumar' : 'Swathi Reddy' }));

export function StoreProvider({ children, liveSession, onSignOut }: { children: ReactNode; liveSession?: Session | null; onSignOut?: () => void }) {
  const live = !!supabase && !!liveSession;
  const [demoSession, setDemoSession] = useState<Session>({ name: 'Anitha Rao', role: 'super_admin', districts: [] });
  const session = live ? liveSession! : demoSession;
  const [loading, setLoading] = useState(live);
  const [stories, setStories] = useState<CmsStory[]>(live ? [] : demoStories);
  const [submissions, setSubs] = useState<CitizenSubmission[]>(live ? [] : SUBMISSIONS);
  const [ads, setAds] = useState<Ad[]>(live ? [] : ADS);
  const [polls, setPolls] = useState<Poll[]>(live ? [] : POLLS);
  const [users, setUsers] = useState<CmsUser[]>(live ? [] : DEMO_USERS);
  const [adFrequency, setFreq] = useState(8);
  const [analytics, setAnalytics] = useState<DailyStat[]>(live ? [] : ANALYTICS);
  const [districtStats, setDistrictStats] = useState<DistrictStat[]>(live ? [] : DISTRICT_STATS);
  const [msg, setMsg] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3200); }, []);
  const fail = useCallback((e: unknown) => { toast(`⚠ ${(e as Error).message}`); return false as const; }, [toast]);

  // Load everything for the signed-in user. Each section loads independently so one
  // permission-denied section (e.g. Ads for an editor) doesn't blank the others.
  useEffect(() => {
    if (!live) return;
    let alive = true;
    setLoading(true);
    const isAdmin = session.role === 'super_admin';
    const jobs: [string, Promise<unknown>, (v: never) => void][] = [
      ['stories', db.loadStories(), setStories as never],
      ['citizen reports', session.role === 'reporter' ? Promise.resolve([]) : db.loadSubmissions(), setSubs as never],
      ['polls', db.loadPolls(), setPolls as never],
      ['ad frequency', db.loadAdFrequency(), setFreq as never],
      ['analytics', session.role === 'reporter' ? Promise.resolve({ daily: [], districts: [] }) : db.loadAnalytics(),
        ((v: { daily: DailyStat[]; districts: DistrictStat[] }) => { setAnalytics(v.daily); setDistrictStats(v.districts); }) as never],
      ['ads', isAdmin ? db.loadAds() : Promise.resolve([]), setAds as never],
      ['users', isAdmin ? db.loadUsers() : Promise.resolve([]), setUsers as never],
    ];
    Promise.allSettled(jobs.map(([, p]) => p)).then((results) => {
      if (!alive) return;
      const failed: string[] = [];
      results.forEach((r, i) => (r.status === 'fulfilled' ? jobs[i][2](r.value as never) : failed.push(`${jobs[i][0]}: ${(r.reason as Error).message}`)));
      if (failed.length) toast(`⚠ Could not load ${failed.join('; ')}`);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [live, session.role, session.userId, version, toast]);

  const value = useMemo<Ctx>(() => ({
    live, loading, session, toast,
    setSession: (s) => { if (!live) setDemoSession(s); },
    signOut: () => onSignOut?.(),
    reload: () => setVersion((v) => v + 1),

    stories,
    saveStory: async (s, opts) => {
      const wasPublished = stories.find((x) => x.id === s.id)?.status === 'published';
      if (!live) {
        const saved = { ...s, publishedAt: s.status === 'published' && !wasPublished ? new Date().toISOString() : s.publishedAt,
          image: opts.imageFile ? URL.createObjectURL(opts.imageFile) : s.image };
        setStories((all) => (all.some((x) => x.id === s.id) ? all.map((x) => (x.id === s.id ? saved : x)) : [saved, ...all]));
        return saved;
      }
      try {
        const saved = await db.saveStory(s, { ...opts, wasPublished, userId: session.userId! });
        setStories((all) => (all.some((x) => x.id === saved.id) ? all.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...all]));
        return saved;
      } catch (e) { fail(e); return null; }
    },
    deleteStory: async (id) => {
      try { if (live) await db.deleteStory(id); setStories((all) => all.filter((x) => x.id !== id)); return true; } catch (e) { return fail(e); }
    },

    submissions,
    approveSubmission: async (id, headline, body) => {
      const sub = submissions.find((x) => x.id === id);
      if (!sub) return false;
      try {
        let story: CmsStory;
        if (live) story = await db.approveSubmission(id, headline, body);
        else {
          const m = MANDALS.find((x) => x.id === sub.mandalId)!;
          story = {
            id: `cit-${sub.id}`, category: sub.category, stateId: sub.districtId === 'vsp' ? 'ap' : 'tg', districtId: sub.districtId, mandalId: sub.mandalId,
            lat: m.lat, lng: m.lng, image: sub.media[0] ?? '', source: 'Citizen Reporter', publishedAt: new Date().toISOString(),
            reporter: { name: sub.reporterName, verified: sub.verified, citizen: true },
            reactions: { like: 0, wow: 0, sad: 0, angry: 0 }, comments: 0, shares: 0, views: 0,
            content: { en: { headline, summary: body }, [sub.lang]: { headline, summary: body } },
            status: 'published', pushOnPublish: false, author: session.name,
          };
        }
        setStories((all) => [story, ...all.filter((x) => x.id !== story.id)]);
        setSubs((all) => all.map((x) => (x.id === id ? { ...x, status: 'approved', headline, body } : x)));
        return true;
      } catch (e) { return fail(e); }
    },
    rejectSubmission: async (id) => {
      try {
        if (live) await db.rejectSubmission(id, session.userId!);
        setSubs((all) => all.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x)));
        return true;
      } catch (e) { return fail(e); }
    },

    ads,
    upsertAd: async (a) => {
      try {
        if (live) await db.saveAd(a);
        setAds((all) => (all.some((x) => x.id === a.id) ? all.map((x) => (x.id === a.id ? a : x)) : [a, ...all]));
        return true;
      } catch (e) { return fail(e); }
    },

    polls,
    addPoll: async (p) => {
      try { if (live) await db.createPoll(p); setPolls((all) => [p, ...all]); return true; } catch (e) { return fail(e); }
    },

    users,
    updateUser: async (id, patch) => {
      // Optimistic: controls update instantly; revert if the database rejects the change.
      const before = users.find((u) => u.id === id);
      setUsers((all) => all.map((u) => (u.id === id ? { ...u, ...patch } : u)));
      try { if (live) await db.updateUser(id, patch); return true; } catch (e) {
        if (before) setUsers((all) => all.map((u) => (u.id === id ? before : u)));
        return fail(e);
      }
    },

    adFrequency,
    setAdFrequency: async (n) => {
      try { if (live) await db.saveAdFrequency(n); setFreq(n); return true; } catch (e) { return fail(e); }
    },

    analytics, districtStats,
  }), [live, loading, session, toast, fail, onSignOut, stories, submissions, ads, polls, users, adFrequency, analytics, districtStats]);

  return (
    <StoreCtx.Provider value={value}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider missing');
  return c;
}

/** Stories visible to the current role (moderators/reporters are scoped to their districts). */
export function useScopedStories() {
  const { stories, session } = useStore();
  return session.districts.length ? stories.filter((s) => session.districts.includes(s.districtId)) : stories;
}
