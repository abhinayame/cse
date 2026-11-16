/**
 * Rich push notifications (FCM via Expo push). Tokens are stored in `push_tokens` with the
 * user's district + interests so the `send-push` edge function can target by location and topic.
 */
import { Platform } from 'react-native';
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
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return null; // asked contextually from onboarding/settings, not on launch
  const token = (await Notifications.getExpoPushTokenAsync().catch(() => null))?.data;
  if (token && supabase) {
    const p = usePrefs.getState();
    await supabase.from('push_tokens').upsert({
      token, platform: Platform.OS, district_id: p.districtId, mandal_id: p.mandalId, language: p.language,
      interests: p.interests, prefs: p.notifications,
    });
  }
  return token;
}

export async function requestPushPermission() {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') await registerForPush();
  return status === 'granted';
}
