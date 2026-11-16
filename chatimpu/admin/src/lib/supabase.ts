import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').replace(/\/+$/, '');
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** null in demo mode (no keys configured) */
export const supabase = supabaseUrl && key
  ? createClient(supabaseUrl, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'chatimpu.cms.auth' } })
  : null;
export const isDemo = !supabase;
