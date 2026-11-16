import { View } from 'react-native';
import { Icon, Txt } from '@/components/ui';
import { ALERT_META } from './LocalMap';
import { pick } from '@/lib/text';
import { useT } from '@/i18n';
import { palette, radius, useTheme } from '@/theme';
import type { LocalAlert } from '@/data/types';

export function AlertRow({ alert, lang }: { alert: LocalAlert; lang: string }) {
  const t = useTheme();
  const tr = useT();
  const meta = ALERT_META[alert.kind];
  const l = (alert.title as Record<string, string>)[lang] ? lang : 'en';
  const live = new Date(alert.startsAt).getTime() <= Date.now();
  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: alert.severity === 'critical' ? palette.red : t.colors.border }}>
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: meta.color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt v="overline" color={meta.color}>{tr(`alert_${alert.kind}`)}</Txt>
          {live && <View style={{ paddingHorizontal: 6, borderRadius: 4, backgroundColor: alert.severity === 'critical' ? palette.red : t.colors.surfaceAlt }}><Txt v="caption" color={alert.severity === 'critical' ? '#fff' : t.colors.textMuted} style={{ fontSize: 10 }}>LIVE</Txt></View>}
        </View>
        <Txt v="title" lang={l}>{pick(alert.title, lang)}</Txt>
        <Txt v="bodySm" lang={l} muted>{pick(alert.detail, lang)}</Txt>
      </View>
    </View>
  );
}
