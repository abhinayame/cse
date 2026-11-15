import { View } from 'react-native';
import { Shimmer } from '@/components/ui';
import { useTheme } from '@/theme';

export function FeedSkeleton({ width, height, bottomInset }: { width: number; height: number; bottomInset: number }) {
  const t = useTheme();
  return (
    <View style={{ width, height, backgroundColor: t.colors.bg }}>
      <Shimmer style={{ width, height: height * 0.4 + 24, borderRadius: 0 }} />
      <View style={{ flex: 1, marginTop: -24, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: t.colors.bg, padding: 22, gap: 12, paddingBottom: bottomInset }}>
        <Shimmer style={{ width: '55%', height: 12 }} />
        <Shimmer style={{ width: '95%', height: 24 }} />
        <Shimmer style={{ width: '80%', height: 24 }} />
        <Shimmer style={{ width: 36, height: 3, marginVertical: 6 }} />
        {[100, 96, 98, 90, 94, 60].map((w, i) => <Shimmer key={i} style={{ width: `${w}%`, height: 14 }} />)}
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Shimmer style={{ width: 96, height: 40, borderRadius: 20 }} />
          <Shimmer style={{ width: 70, height: 40, borderRadius: 20 }} />
        </View>
      </View>
    </View>
  );
}
