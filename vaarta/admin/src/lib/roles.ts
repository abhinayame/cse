import type { Role } from '@data/types';

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin', editor: 'Editor', district_moderator: 'District Moderator', reporter: 'Reporter',
};

export type Section = 'dashboard' | 'stories' | 'moderation' | 'analytics' | 'ads' | 'polls' | 'users';

/** Mirrors the RLS policies in supabase/migrations/0002_rls.sql */
export const CAN: Record<Role, Section[]> = {
  super_admin: ['dashboard', 'stories', 'moderation', 'analytics', 'ads', 'polls', 'users'],
  editor: ['dashboard', 'stories', 'moderation', 'analytics', 'polls'],
  district_moderator: ['dashboard', 'stories', 'moderation', 'analytics'],
  reporter: ['stories'],
};

export const canPublish = (r: Role) => r !== 'reporter';
