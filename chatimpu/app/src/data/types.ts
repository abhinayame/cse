/**
 * Shared domain types. Mirrors supabase/migrations/0001_schema.sql.
 * This folder has no React Native imports so the admin CMS can import it too.
 */
export type ContentLang = 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml' | 'mr' | 'bn' | 'gu';

export type CategoryId =
  | 'politics' | 'cinema' | 'sports' | 'business' | 'tech' | 'jobs'
  | 'education' | 'devotional' | 'agriculture' | 'health' | 'crime' | 'weather';

export interface State { id: string; name: string; nameTe: string }
export interface District { id: string; stateId: string; name: string; nameTe: string; lat: number; lng: number }
export interface Mandal { id: string; districtId: string; name: string; nameTe: string; lat: number; lng: number }
export interface Village { id: string; mandalId: string; name: string; nameTe: string }

export interface StoryText { headline: string; summary: string }

export interface Reactions { like: number; wow: number; sad: number; angry: number }
export type ReactionKind = keyof Reactions;

export interface Story {
  id: string;
  category: CategoryId;
  stateId: string;
  districtId: string;
  mandalId: string;
  villageId?: string;
  lat: number;
  lng: number;
  image: string;
  source: string;
  sourceUrl?: string;
  /** ISO timestamp */
  publishedAt: string;
  isBreaking?: boolean;
  isTrending?: boolean;
  /** Sponsored local story — always rendered with a "Sponsored" label */
  sponsor?: string;
  reporter?: { name: string; verified: boolean; citizen?: boolean };
  reactions: Reactions;
  comments: number;
  shares: number;
  views: number;
  content: Partial<Record<ContentLang, StoryText>> & { en: StoryText };
  tags?: string[];
}

export interface PollOption { id: string; label: Partial<Record<ContentLang, string>> & { en: string } }
export interface Poll {
  id: string;
  question: Partial<Record<ContentLang, string>> & { en: string };
  options: PollOption[];
  /** votes[scope][optionId]; scope is 'national' or a districtId */
  votes: Record<string, Record<string, number>>;
  closesAt: string;
  category: CategoryId;
}

export interface Magazine {
  id: string;
  theme: 'travel' | 'health' | 'finance' | 'food' | 'heritage';
  title: Partial<Record<ContentLang, string>> & { en: string };
  subtitle: Partial<Record<ContentLang, string>> & { en: string };
  cover: string;
  storyIds: string[];
}

export type AlertKind = 'power' | 'water' | 'traffic' | 'weather' | 'jobs' | 'events';
export interface LocalAlert {
  id: string;
  kind: AlertKind;
  districtId: string;
  mandalId: string;
  lat: number;
  lng: number;
  title: Partial<Record<ContentLang, string>> & { en: string };
  detail: Partial<Record<ContentLang, string>> & { en: string };
  startsAt: string;
  endsAt?: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface Ad {
  id: string;
  advertiser: string;
  districtIds: string[] | 'all';
  image: string;
  headline: Partial<Record<ContentLang, string>> & { en: string };
  body: Partial<Record<ContentLang, string>> & { en: string };
  cta: Partial<Record<ContentLang, string>> & { en: string };
  url: string;
  /** Business listing info for local business ads */
  phone?: string;
  impressions: number;
  clicks: number;
  budgetInr: number;
  status: 'active' | 'paused' | 'ended';
}

export interface VideoStory {
  id: string;
  storyId?: string;
  uri: string;
  poster: string;
  districtId: string;
  category: CategoryId;
  durationSec: number;
  caption: Partial<Record<ContentLang, string>> & { en: string };
  /** timed captions (seconds) */
  subtitles: { at: number; text: Partial<Record<ContentLang, string>> & { en: string } }[];
  likes: number;
  shares: number;
  /** News Reels headline strip: short white line on top, bold red line below */
  headlineTop?: Partial<Record<ContentLang, string>>;
  headline?: Partial<Record<ContentLang, string>>;
  series?: string | null;
  episode?: number | null;
  episodeTotal?: number | null;
}

export type Role = 'super_admin' | 'editor' | 'district_moderator' | 'reporter';

export interface CitizenSubmission {
  id: string;
  reporterName: string;
  reporterPhone: string;
  verified: boolean;
  headline: string;
  body: string;
  lang: ContentLang;
  category: CategoryId;
  districtId: string;
  mandalId: string;
  media: string[];
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  aiFlags?: string[];
}
