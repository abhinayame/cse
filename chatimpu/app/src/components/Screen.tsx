import type { ReactNode } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Icon, Tap, Txt } from '@/components/ui';
import { useTabBarSpace } from '@/components/GlassTabBar';
import { useTheme } from '@/theme';

interface Props extends ScrollViewProps {
  title?: string;
  kicker?: string;
  back?: boolean;
  right?: ReactNode;
  children: ReactNode;
  /** leave room for the floating tab bar */
  tabs?: boolean;
  scroll?: boolean;
}

/** Standard scrolling page with an editorial serif header. */
export function Screen({ title, kicker, back, right, children, tabs, scroll = true, ...rest }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const header = (title || back) && (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
      {back && (
        <Tap onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/feed'))} accessibilityLabel="Back"
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surfaceAlt, marginBottom: 2 }}>
          <Icon name="chevron-back" size={20} />
        </Tap>
      )}
      <View style={{ flex: 1 }}>
        {kicker ? <Txt v="overline" color={t.colors.accentText}>{kicker}</Txt> : null}
        {title ? <Txt v={back ? 'h2' : 'display'} numberOfLines={2}>{title}</Txt> : null}
      </View>
      {right}
    </View>
  );
  if (!scroll) return <View style={{ flex: 1, backgroundColor: t.colors.bg }}>{header}{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      <ScrollView {...rest} contentContainerStyle={[{ paddingBottom: (tabs ? tabSpace : insets.bottom) + 24 }, rest.contentContainerStyle]}>
        {header}
        {children}
      </ScrollView>
    </View>
  );
}

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 28 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 }}>
        <Txt v="h3">{title}</Txt>
        {action ? <Tap onPress={onAction}><Txt v="label" color={t.colors.accentText}>{action}</Txt></Tap> : null}
      </View>
      {children}
    </View>
  );
}
