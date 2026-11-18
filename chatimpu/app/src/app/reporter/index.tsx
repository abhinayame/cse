import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chip, Icon, Tap, Txt, type IconName } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { Emblem, Wordmark } from '@/components/Brand';
import { DISTRICTS, MANDALS } from '@/data/locations';
import { CATEGORIES } from '@/lib/categories';
import { useT } from '@/i18n';
import { palette, radius, useTheme } from '@/theme';
import { usePrefs } from '@/store/prefs';
import { register, rupees } from '@/reporter/api';
import { useRT } from '@/reporter/i18n';
import { Banner, Card, Field, go, repStatus, useReporter } from '@/reporter/ui';

export default function ReporterHome() {
  const { dash } = useReporter();
  return dash.profile ? <Dashboard /> : <Register />;
}

function Dashboard() {
  const t = useTheme(); const rt = useRT(); const te = usePrefs((s) => s.language) === 'te';
  const { dash } = useReporter();
  const p = dash.profile!; const w = dash.wallet;
  const pct = Math.min(100, Math.round((w.available_paise / Math.max(1, dash.threshold_paise)) * 100));
  const eligible = w.available_paise >= dash.threshold_paise;
  const banner = p.status !== 'active' ? (rt(`stBanner_${p.status}` as never) as string | undefined) : undefined;
  const tiles: [IconName, string, string, string?][] = [
    ['add-circle', rt('submitNews'), '/reporter/submit'],
    ['newspaper', rt('myNews'), '/reporter/submissions', dash.counts.correction_required ? `${dash.counts.correction_required} ✎` : undefined],
    ['flag', rt('assignments'), '/reporter/assignments'],
    ['wallet', rt('wallet'), '/reporter/withdraw'],
    ['card', rt('tabMethods'), '/reporter/methods'],
    ['notifications', rt('notifications'), '/reporter/notifications', dash.unread ? String(dash.unread) : undefined],
    ['person-circle', rt('profile'), '/reporter/profile'],
    ['receipt', rt('tabHistory'), '/reporter/history'],
  ];
  return (
    <Screen back title={rt('brandSub')}>
      <View style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Emblem size={52} />
        <View style={{ flex: 1 }}>
          <Txt v="h3" numberOfLines={1}>{p.full_name}</Txt>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>{repStatus(rt, p.status)}<Txt v="caption" muted>{rt(`cat_${p.category}` as never)} · {dash.level}</Txt></View>
        </View>
      </View>
      {banner && <View style={{ marginHorizontal: 20, marginTop: 14 }}><Banner tone={p.status === 'suspended' || p.status === 'rejected' ? 'bad' : 'warn'} text={banner + (p.status_reason ? `\n${p.status_reason}` : '')}
        action={p.status === 'registered' ? { label: rt('addId'), onPress: () => go('/reporter/profile') } : undefined} /></View>}

      <Tap onPress={() => go('/reporter/withdraw')} scaleTo={0.98} style={{ marginHorizontal: 20, marginTop: 16, borderRadius: 22, padding: 20, backgroundColor: palette.ink, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(237,28,36,0.35)' }} />
        <Txt v="bodySm" color="#BDBDBD">{rt('available')}</Txt>
        <Txt lang="en" style={{ fontFamily: 'Inter_700Bold', fontSize: 36, lineHeight: 44, color: palette.white }}>{rupees(w.available_paise)}</Txt>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 10, overflow: 'hidden' }}><View style={{ width: `${pct}%`, height: 8, backgroundColor: palette.red }} /></View>
        <Txt v="caption" color="#E0E0E0" style={{ marginTop: 8 }}>{eligible ? rt('eligible') : `${rupees(dash.threshold_paise - w.available_paise)} ${rt('toGo')} ${rupees(dash.threshold_paise)}`}</Txt>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          {[[rt('pending'), dash.pending_earnings_paise], [rt('totalEarned'), w.lifetime_earned_paise], [rt('withdrawn'), w.paid_paise]].map(([l, v]) => (
            <View key={String(l)} style={{ flex: 1 }}><Txt v="caption" color="#BDBDBD" numberOfLines={1}>{l}</Txt><Txt lang="en" style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 20, color: palette.white }}>{rupees(Number(v))}</Txt></View>
          ))}
        </View>
      </Tap>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 14, marginTop: 10 }}>
        {[[dash.counts.total, rt('submissions')], [dash.counts.approved, rt('approved')], [dash.counts.under_review, rt('underReview')], [dash.counts.rejected, rt('rejected')]].map(([n, l]) => (
          <View key={String(l)} style={{ width: '50%', padding: 6 }}>
            <View style={{ padding: 14, borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}>
              <Txt lang="en" style={{ fontFamily: 'Inter_700Bold', fontSize: 24, lineHeight: 30, color: t.colors.text }}>{n}</Txt><Txt v="caption" muted>{l}</Txt>
            </View>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 14, marginTop: 4 }}>
        {tiles.map(([icon, label, to, badge]) => (
          <View key={to} style={{ width: '25%', padding: 6 }}>
            <Tap onPress={() => go(to)} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }}>
              <View><Icon name={icon} size={24} color={to === '/reporter/submit' ? palette.red : palette.navy} />
                {badge && <View style={{ position: 'absolute', top: -6, right: -14, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: palette.red, alignItems: 'center', justifyContent: 'center' }}><Txt lang="en" style={{ fontSize: 10, lineHeight: 12, color: palette.white, fontFamily: 'Inter_700Bold' }}>{badge}</Txt></View>}</View>
              <Txt v="caption" align="center" numberOfLines={1}>{label}</Txt>
            </Tap>
          </View>
        ))}
      </View>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt v="title">{rt('rank')}</Txt><Txt v="h3">{dash.rank ? `#${dash.rank}` : '—'}</Txt></View>
        <Txt v="caption" muted style={{ marginTop: 6 }}>{dash.badges.length ? dash.badges.map((b) => (te ? b.name_te : b.name_en)).join(' · ') : rt('noBadges')}</Txt>
      </Card>
      <Txt v="caption" muted align="center" style={{ marginHorizontal: 30, marginTop: 18 }}>{rt('contributorNote')}</Txt>
    </Screen>
  );
}

function Register() {
  const rt = useRT(); const tr = useT(); const prefs = usePrefs();
  const { reload } = useReporter();
  const te = prefs.language === 'te';
  const [f, setF] = useState({ full_name: prefs.user?.name ?? '', email: '', district: prefs.districtId, mandal: prefs.mandalId, locality: '', interests: prefs.interests.slice(0, 4) as string[], intro: '', accept: false });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const mandals = MANDALS.filter((m) => m.districtId === f.district);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await register({ ...f, language: prefs.language === 'en' ? 'en' : 'te' }); await reload(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Screen back title={rt('joinTitle')}>
      <View style={{ marginHorizontal: 20, alignItems: 'center', marginBottom: 6 }}><Emblem size={72} /><Wordmark size={30} onDark={false} /></View>
      <Card>
        <Field label={rt('fullName')} value={f.full_name} onChangeText={(v) => setF({ ...f, full_name: v })} autoComplete="name" />
        <Field label={rt('email')} value={f.email} onChangeText={(v) => setF({ ...f, email: v.trim() })} keyboardType="email-address" autoCapitalize="none" />
        <Txt v="label" style={{ marginBottom: 6 }}>{rt('district')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {DISTRICTS.map((d) => <Chip key={d.id} small label={te ? d.nameTe : d.name} selected={f.district === d.id} onPress={() => setF({ ...f, district: d.id, mandal: MANDALS.find((m) => m.districtId === d.id)?.id ?? '' })} />)}
        </View>
        <Txt v="label" style={{ marginBottom: 6 }}>{rt('mandal')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {mandals.map((m) => <Chip key={m.id} small label={te ? m.nameTe : m.name} selected={f.mandal === m.id} onPress={() => setF({ ...f, mandal: m.id })} />)}
        </View>
        <Field label={rt('locality')} value={f.locality} onChangeText={(v) => setF({ ...f, locality: v })} />
        <Txt v="label" style={{ marginBottom: 6 }}>{rt('interests')}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {CATEGORIES.map((c) => <Chip key={c.id} small icon={c.icon} label={tr(`cat_${c.id}` as never)} selected={f.interests.includes(c.id)}
            onPress={() => setF({ ...f, interests: f.interests.includes(c.id) ? f.interests.filter((x) => x !== c.id) : [...f.interests, c.id] })} />)}
        </View>
        <Field label={rt('intro')} placeholder={rt('introHint')} value={f.intro} onChangeText={(v) => setF({ ...f, intro: v })} multiline maxLength={600} />
      </Card>
      <Card>
        <Txt v="title">{rt('agreement')}</Txt>
        <Txt v="bodySm" muted style={{ marginTop: 6 }}>{rt('contributorNote')}</Txt>
        <Tap onPress={() => go('/reporter/help')} style={{ marginTop: 8 }}><Txt v="label" color={palette.red}>{rt('help')} →</Txt></Tap>
        <Tap onPress={() => setF({ ...f, accept: !f.accept })} accessibilityRole="checkbox" accessibilityState={{ checked: f.accept }} style={{ flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'flex-start' }}>
          <Icon name={f.accept ? 'checkbox' : 'square-outline'} size={22} color={palette.red} /><Txt v="bodySm" style={{ flex: 1 }}>{rt('agree')}</Txt>
        </Tap>
      </Card>
      <View style={{ marginHorizontal: 20, marginTop: 14, gap: 10 }}>
        {err && <Banner tone="bad" text={err} />}
        <Button label={busy ? rt('saving') : rt('finish')} loading={busy} disabled={!f.accept || f.full_name.trim().length < 2} onPress={submit} />
      </View>
    </Screen>
  );
}
