/**
 * CMS state. Demo mode keeps everything in memory, seeded from the app's sample data
 * (../app/src/data). With VITE_SUPABASE_URL/ANON_KEY set, `lib/supabase.ts` persists the
 * same operations to Postgres (see supabase/migrations).
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { STORIES } from '@data/stories';
import { ADS, POLLS, SUBMISSIONS } from '@data/catalog';
import type { Ad, CitizenSubmission, Poll, Role, Story } from '@data/types';

export type StoryStatus = 'draft' | 'scheduled' | 'published';
export interface CmsStory extends Story { status: StoryStatus; publishAt?: string; pushOnPublish: boolean; author: string }

export interface CmsUser { id: string; name: string; phone: string; role: Role | 'reader'; districts: string[]; verifiedReporter: boolean; joined: string }

const USERS: CmsUser[] = [
  { id: 'u1', name: 'Anitha Rao', phone: '98490 11223', role: 'super_admin', districts: [], verifiedReporter: true, joined: '2025-01-10' },
  { id: 'u2', name: 'Kiran Kumar', phone: '99080 22334', role: 'editor', districts: [], verifiedReporter: true, joined: '2025-02-03' },
  { id: 'u3', name: 'Swathi Reddy', phone: '90000 33445', role: 'district_moderator', districts: ['wgl'], verifiedReporter: true, joined: '2025-03-18' },
  { id: 'u4', name: 'Imran Shaik', phone: '94400 44556', role: 'district_moderator', districts: ['vsp'], verifiedReporter: true, joined: '2025-04-07' },
  { id: 'u5', name: 'Ravi Teja K.', phone: '91000 55667', role: 'reporter', districts: ['vsp'], verifiedReporter: true, joined: '2025-06-21' },
  { id: 'u6', name: 'Ayesha Fatima', phone: '97000 66778', role: 'reader', districts: ['hyd'], verifiedReporter: true, joined: '2025-08-02' },
  { id: 'u7', name: 'Mahesh Goud', phone: '98480 77889', role: 'reader', districts: ['hyd'], verifiedReporter: false, joined: '2025-09-30' },
];

export interface Session { name: string; role: Role; districts: string[] }

interface Ctx {
  session: Session;
  setSession: (s: Session) => void;
  stories: CmsStory[];
  upsertStory: (s: CmsStory) => void;
  deleteStory: (id: string) => void;
  submissions: CitizenSubmission[];
  setSubmission: (id: string, patch: Partial<CitizenSubmission>) => void;
  ads: Ad[];
  upsertAd: (a: Ad) => void;
  polls: Poll[];
  addPoll: (p: Poll) => void;
  users: CmsUser[];
  updateUser: (id: string, patch: Partial<CmsUser>) => void;
  adFrequency: number;
  setAdFrequency: (n: number) => void;
  toast: (msg: string) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ name: 'Anitha Rao', role: 'super_admin', districts: [] });
  const [stories, setStories] = useState<CmsStory[]>(() => STORIES.map((s, i) => ({ ...s, status: 'published', pushOnPublish: !!s.isBreaking, author: i % 3 ? 'Kiran Kumar' : 'Swathi Reddy' })));
  const [submissions, setSubs] = useState(SUBMISSIONS);
  const [ads, setAds] = useState(ADS);
  const [polls, setPolls] = useState(POLLS);
  const [users, setUsers] = useState(USERS);
  const [adFrequency, setAdFrequency] = useState(8);
  const [msg, setMsg] = useState<string | null>(null);

  const value = useMemo<Ctx>(() => ({
    session, setSession,
    stories,
    upsertStory: (s) => setStories((all) => (all.some((x) => x.id === s.id) ? all.map((x) => (x.id === s.id ? s : x)) : [s, ...all])),
    deleteStory: (id) => setStories((all) => all.filter((x) => x.id !== id)),
    submissions,
    setSubmission: (id, patch) => setSubs((all) => all.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    ads,
    upsertAd: (a) => setAds((all) => (all.some((x) => x.id === a.id) ? all.map((x) => (x.id === a.id ? a : x)) : [a, ...all])),
    polls,
    addPoll: (p) => setPolls((all) => [p, ...all]),
    users,
    updateUser: (id, patch) => setUsers((all) => all.map((u) => (u.id === id ? { ...u, ...patch } : u))),
    adFrequency, setAdFrequency,
    toast: (m) => { setMsg(m); setTimeout(() => setMsg(null), 2600); },
  }), [session, stories, submissions, ads, polls, users, adFrequency]);

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
