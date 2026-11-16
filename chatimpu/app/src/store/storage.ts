import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** AsyncStorage-backed JSON storage that never throws (private mode / SSR safe). */
export const safeStorage = createJSONStorage(() => ({
  getItem: async (k: string) => { try { return await AsyncStorage.getItem(k); } catch { return null; } },
  setItem: async (k: string, v: string) => { try { await AsyncStorage.setItem(k, v); } catch {} },
  removeItem: async (k: string) => { try { await AsyncStorage.removeItem(k); } catch {} },
}));
