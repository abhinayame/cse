import type { Role } from '@data/types';
import type { Session } from './store';

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin', editor: 'Editor', district_moderator: 'District Moderator', reporter: 'Reporter',
};

export type Section = 'help' | 'corrections' | 'community' | 'reels' | 'status' | 'intake' | 'dashboard' | 'stories' | 'moderation' | 'editorial' | 'reporters' | 'assignments' | 'recognition' | 'finance' | 'analytics' | 'ads' | 'polls' | 'users';

/** Mirrors the RLS policies in supabase/migrations/0002_rls.sql and 0005_reporters.sql. */
export const CAN: Record<Role, Section[]> = {
  super_admin: ['help', 'corrections', 'community', 'reels', 'status', 'intake', 'dashboard', 'stories', 'moderation', 'editorial', 'reporters', 'assignments', 'recognition', 'finance', 'analytics', 'ads', 'polls', 'users'],
  editor: ['help', 'corrections', 'community', 'reels', 'status', 'intake', 'dashboard', 'stories', 'moderation', 'editorial', 'reporters', 'assignments', 'recognition', 'analytics', 'polls'],
  district_moderator: ['corrections', 'community', 'reels', 'dashboard', 'stories', 'moderation', 'editorial', 'reporters', 'assignments', 'analytics'],
  reporter: ['stories'],
};

/**
 * Sections a signed-in person may open. Finance is a separate permission: editors never get it
 * from their role, and a finance-only account (no newsroom role) sees only the finance desk.
 */
export function sectionsFor(s: Session): Section[] {
  const base: Section[] = s.staffRole === false ? [] : CAN[s.role];
  const extra: Section[] = [];
  if (s.permissions?.includes('finance')) extra.push('finance');
  if (s.permissions?.includes('reporter_admin')) extra.push('reporters');
  return [...new Set([...base, ...extra])];
}

export const canPublish = (r: Role) => r !== 'reporter';
