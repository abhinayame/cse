import { Tabs } from 'expo-router/tabs';
import { GlassTabBar } from '@/components/GlassTabBar';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={(p) => <GlassTabBar {...p} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.colors.bg } }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="videos" />
      <Tabs.Screen name="local" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
