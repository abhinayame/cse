import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { latinFonts } from '@/theme/fonts';
import { useTheme } from '@/theme';
import { usePrefs } from '@/store/prefs';
import { useLanguageFonts } from '@/hooks/useLanguageFonts';
import { initNotificationRouting, registerForPush } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [latinReady] = useFonts(latinFonts);
  const hydrated = usePrefs((s) => s.hydrated);
  const lang = usePrefs((s) => s.language);
  const langReady = useLanguageFonts(lang);
  const t = useTheme();
  const ready = latinReady && hydrated && langReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => { registerForPush().catch(() => {}); return initNotificationRouting(); }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: '#0A0A0A' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.bg }, animation: 'fade_from_bottom' }}>
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="search" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="report" options={{ presentation: 'modal' }} />
          <Stack.Screen name="digest" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
