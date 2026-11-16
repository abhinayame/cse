import { View } from 'react-native';
import { EmptyState } from '@/components/ui';
import { useT } from '@/i18n';
import { useTheme } from '@/theme';

export function EndCard({ width, height }: { width: number; height: number }) {
  const tr = useT();
  const t = useTheme();
  return (
    <View style={{ width, height, backgroundColor: t.colors.bg, justifyContent: 'center' }}>
      <EmptyState title={tr('allCaughtUp')} sub={tr('allCaughtUpSub')} />
    </View>
  );
}
