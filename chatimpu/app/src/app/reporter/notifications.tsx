import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Txt } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { palette } from '@/theme';
import { usePrefs } from '@/store/prefs';
import { openNotificationUrl } from '@/lib/notifications';
import { markAllRead, notifications, type Notification } from '@/reporter/api';
import { useRT } from '@/reporter/i18n';
import { Card, ListRow, useReporter, when } from '@/reporter/ui';

export default function Notifications() {
  const rt = useRT(); const te = usePrefs((s) => s.language) === 'te'; const { dash, reload } = useReporter();
  const [rows, setRows] = useState<Notification[] | null>(null);
  useFocusEffect(useCallback(() => { notifications().then(setRows).catch(() => setRows([])); }, []));
  const readAll = async () => { await markAllRead(); setRows((r) => r?.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })) ?? null); reload(); };
  return (
    <Screen back title={rt('notifications')} right={dash.unread > 0 ? <Txt v="label" color={palette.red} onPress={readAll}>{rt('markAllRead')}</Txt> : undefined}>
      <Card style={{ paddingVertical: 4 }}>
        {rows === null ? <Txt muted style={{ padding: 12 }}>…</Txt> : rows.length === 0 ? <Txt v="bodySm" muted align="center" style={{ padding: 20 }}>{rt('noNotifications')}</Txt> : rows.map((n) => (
          <ListRow key={n.id} title={(te ? n.title_te ?? n.title_en : n.title_en)} meta={[(te ? n.body_te ?? n.body_en : n.body_en), when(n.created_at, te)].filter(Boolean).join('\n')}
            right={!n.read_at ? <View accessibilityLabel="unread" style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: palette.red }} /> : undefined}
            onPress={n.link ? () => openNotificationUrl(`chatimpu:/${n.link}`) : undefined} />
        ))}
      </Card>
    </Screen>
  );
}
