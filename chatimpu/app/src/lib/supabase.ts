import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseAnonKey?: string };
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '').replace(/\/+$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '';

/** null when running in demo mode (no backend configured) */
export const supabase: SupabaseClient | null = url && key
  ? createClient(url, key, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
  : null;

export const isDemoMode = !supabase;

/** Storage path → public URL (full URLs pass through). Paths come back bare when no image CDN is configured. */
export const mediaUrl = (p?: string | null) =>
  !p ? '' : /^(https?:|file:|data:)/.test(p) ? p : `${url}/storage/v1/object/public/media/${p.replace(/^\/+/, '')}`;
