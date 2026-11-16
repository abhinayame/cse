import type { ReactNode } from 'react';
import { Switch, View } from 'react-native';
import { Icon, Tap, Txt, type IconName } from '@/components/ui';
import { palette, radius, useTheme } from '@/theme';

export function Group({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ marginHorizontal: 20, borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, overflow: 'hidden' }}>{children}</View>;
}

interface RowProps { icon: IconName; label: string; value?: string; onPress?: () => void; toggle?: boolean; onToggle?: (v: boolean) => void; last?: boolean; tint?: string }

export function Row({ icon, label, value, onPress, toggle, onToggle, last, tint }: RowProps) {
  const t = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 56, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.colors.border }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: (tint ?? t.colors.accent) + '22' }}>
        <Icon name={icon} size={17} color={tint ?? t.colors.accentText} />
      </View>
      <Txt v="title" style={{ flex: 1 }}>{label}</Txt>
      {value ? <Txt v="bodySm" muted numberOfLines={1} style={{ maxWidth: 150 }}>{value}</Txt> : null}
      {onToggle ? (
        <Switch value={toggle} onValueChange={onToggle} trackColor={{ true: palette.red, false: t.colors.surfaceAlt }} thumbColor={palette.white} accessibilityLabel={label} />
      ) : onPress ? <Icon name="chevron-forward" size={17} color={t.colors.textFaint} /> : null}
    </View>
  );
  return onPress ? <Tap onPress={onPress} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={label}>{body}</Tap> : body;
}
