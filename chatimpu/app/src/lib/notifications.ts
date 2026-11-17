/**
 * Rich push notifications (FCM via Expo push). Tokens are stored in `push_tokens` with the
 * user's district + interests so the `send-push` edge function can target by location and topic,
 * and with the signed-in user so account notifications (reporter earnings, payouts…) reach them
 * through `notify-dispatch`. Tapping a notification opens the screen in its `url`.
 */
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { usePrefs } from '@/store/prefs';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

export async function registerForPush() {
  if (Platform.OS === 'web') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('breaking', {
      name: 'Breaking news', importance: Notifications.AndroidImportance.HIGH, lightColor: '#E5484D', vibrationPattern: [0, 200, 100, 200],
    });
    await Notifications.setNotificationChannelAsync('local', { name: 'Local alerts', importance: Notifications.AndroidImportance.DEFAULT });
    await Notifications.setNotificationChannelAsync('digest', { name: 'Daily digest', importance: Notifications.AndroidImportance.LOW });
    await Notifications.setNotificationChannelAsync('account', { name: 'Reporter account & payments', importance: Notifications.AndroidImportance.HIGH });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return null; // asked contextually from onboarding/settings, not on launch
  const token = (await Notifications.getExpoPushTokenAsync().catch(() => null))?.data;
  if (token && supabase) {
    const p = usePrefs.getState();
    // Server function: (re)links this device's token to whoever is signed in now.
    await supabase.rpc('register_push_token', {
      p_token: token, p_platform: Platform.OS, p_district: p.districtId, p_mandal: p.mandalId, p_language: p.language,
      p_interests: p.interests, p_prefs: p.notifications,
    });
  }
  return token;
}

/** Opens the in-app screen a notification points to (chatimpu://reporter/…, chatimpu://story/…). */
export function openNotificationUrl(url: unknown) {
  if (typeof url !== 'string') return;
  const path = url.replace(/^chatimpu:\/\//, '/').replace(/^\/+/, '/');
  if (/^\/(reporter|story)(\/|$)/.test(path)) router.push(path as never);
}

/** Call once at startup: handles taps (including the one that launched the app) and re-registers on sign-in. */
export function initNotificationRouting() {
  if (Platform.OS === 'web') return () => {};
  Notifications.getLastNotificationResponseAsync().then((r) => r && openNotificationUrl(r.notification.request.content.data?.url)).catch(() => {});
  const tap = Notifications.addNotificationResponseReceivedListener((r) => openNotificationUrl(r.notification.request.content.data?.url));
  const auth = supabase?.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN') registerForPush().catch(() => {}); });
  return () => { tap.remove(); auth?.data.subscription.unsubscribe(); };
}

export async function requestPushPermission() {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') await registerForPush();
  return status === 'granted';
}
