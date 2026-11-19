/** Shared building blocks for the reporter hub screens (app theme, red · navy · white). */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Icon, Tap, Txt, type IconName } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { OtpLogin } from '@/components/OtpLogin';
import { palette, radius, useTheme } from '@/theme';
import { supabase } from '@/lib/supabase';
import { loadDashboard, type Dashboard } from './api';
import { useRT, type RT } from './i18n';

// ── access gate ─────────────────────────────────────────────────────────────
type Gate = { kind: 'demo' } | { kind: 'loading' } | { kind: 'signedOut' } | { kind: 'error'; message: string } | { kind: 'ready'; dash: Dashboard; userId: string };
interface Ctx { dash: Dashboard; userId: string; reload: () => Promise<void> }
const ReporterCtx = createContext<Ctx | null>(null);
export const useReporter = () => {
  const c = useContext(ReporterCtx);
  if (!c) throw new Error('useReporter outside ReporterGate');
  return c;
};

/** Loads the signed-in reporter's dashboard once for the whole /reporter stack. */
export function ReporterProvider({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<Gate>(supabase ? { kind: 'loading' } : { kind: 'demo' });
  const reload = useCallback(async () => {
    if (!supabase) return;
    const s = (await supabase.auth.getSession()).data.session;
    if (!s) return setGate({ kind: 'signedOut' });
    try { setGate({ kind: 'ready', dash: await loadDashboard(), userId: s.user.id }); } catch (e) { setGate({ kind: 'error', message: (e as Error).message }); }
  }, []);
  useEffect(() => {
    reload();
    const sub = supabase?.auth.onAuthStateChange(() => { reload(); });
    return () => sub?.data.subscription.unsubscribe();
  }, [reload]);
  // Help and the Reporter Academy are open to everyone (people read them before registering).
  const path = usePathname();
  if (/^\/reporter\/(help|academy)/.test(path)) return <>{children}</>;
  return <GateView gate={gate} reload={reload}>{children}</GateView>;
}

function GateView({ gate, reload, children }: { gate: Gate; reload: () => Promise<void>; children: ReactNode }) {
  const rt = useRT();
  if (gate.kind === 'demo') return (
    <Screen back title={rt('brandSub')}>
      <Card><Txt v="h3">Reporter hub needs the backend</Txt>
        <Txt v="bodySm" muted style={{ marginTop: 6 }}>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (docs/SUPABASE_SETUP.md). In demo mode you can still try Citizen Reporter from the feed.</Txt></Card>
    </Screen>
  );
  if (gate.kind === 'loading') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={palette.red} /></View>;
  if (gate.kind === 'signedOut') return (
    <Screen back title={rt('brandSub')}>
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <Txt v="h2">{rt('signInTitle')}</Txt>
        <Txt v="bodySm" muted>{rt('signInSub')}</Txt>
        <OtpLogin onDone={() => { reload(); }} />
      </View>
    </Screen>
  );
  if (gate.kind === 'error') return (
    <Screen back title={rt('brandSub')}><Card><Banner tone="bad" text={gate.message} /><Tap onPress={reload} style={{ marginTop: 12 }}><Txt v="label" color={palette.red}>{rt('retry')}</Txt></Tap></Card></Screen>
  );
  return <ReporterCtx.Provider value={{ dash: gate.dash, userId: gate.userId, reload }}>{children}</ReporterCtx.Provider>;
}

// ── visual pieces ───────────────────────────────────────────────────────────
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[{ marginHorizontal: 20, marginTop: 14, padding: 16, borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border }, style]}>{children}</View>;
}

const TONE: Record<string, 'green' | 'red' | 'amber' | 'blue' | 'grey'> = {
  draft: 'grey', submitted: 'blue', ai_processing: 'blue', under_review: 'blue', on_hold: 'amber', correction_required: 'amber', approved: 'green', published: 'green', rejected: 'red',
  requested: 'blue', processing: 'blue', paid: 'green', failed: 'red', reversed: 'red', cancelled: 'grey',
  registered: 'grey', verification_pending: 'amber', verified: 'blue', active: 'green', suspended: 'red', pending: 'amber',
  open: 'blue', assigned: 'amber', accepted: 'blue', completed: 'green',
};
const TONE_COLORS = { green: ['#1F8A55', 'rgba(31,138,85,0.13)'], red: [palette.redDeep, 'rgba(215,20,26,0.11)'], amber: ['#9A5B0C', 'rgba(217,138,26,0.15)'], blue: [palette.navy, palette.navyTint], grey: ['#5A5A5A', 'rgba(0,0,0,0.06)'] } as const;
export function Pill({ text, status }: { text: string; status: string }) {
  const [fg, bg] = TONE_COLORS[TONE[status] ?? 'grey'];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 24, borderRadius: 12, backgroundColor: bg }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} /><Txt v="label" color={fg} style={{ fontSize: 12, lineHeight: 17 }} numberOfLines={1}>{text}</Txt>
    </View>
  );
}
export const subStatus = (rt: RT, s: string) => <Pill status={s} text={rt(`s_${s}` as never) ?? s} />;
export const wdStatus = (rt: RT, s: string) => <Pill status={s} text={rt(`w_${s}` as never) ?? s} />;
export const repStatus = (rt: RT, s: string) => <Pill status={s} text={rt(`st_${s}` as never) ?? s} />;

export function Banner({ text, tone = 'info', action }: { text: string; tone?: 'info' | 'warn' | 'bad' | 'good'; action?: { label: string; onPress: () => void } }) {
  const t = useTheme();
  const c = { info: [t.colors.surfaceAlt, t.colors.text], warn: ['rgba(217,138,26,0.14)', '#6B4500'], bad: ['rgba(215,20,26,0.10)', palette.redDeep], good: ['rgba(31,138,85,0.12)', '#146B40'] }[tone];
  return (
    <View accessibilityRole={tone === 'bad' ? 'alert' : undefined} style={{ padding: 12, borderRadius: radius.md, backgroundColor: c[0], gap: 8 }}>
      <Txt v="bodySm" color={t.dark && tone !== 'info' ? t.colors.text : c[1]}>{text}</Txt>
      {action && <Tap onPress={action.onPress}><Txt v="label" color={palette.red}>{action.label} →</Txt></Tap>}
    </View>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6, marginBottom: 14 }}>
      <Txt v="label">{label}</Txt>
      <TextInput placeholderTextColor={t.colors.textFaint} accessibilityLabel={label} {...input}
        style={[{ borderRadius: radius.md, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.bg, color: t.colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, minHeight: 48, fontFamily: t.fonts.body }, input.multiline && { minHeight: 110, textAlignVertical: 'top' }, input.style]} />
      {hint && <Txt v="caption" muted>{hint}</Txt>}
    </View>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 6, padding: 4, borderRadius: radius.md, backgroundColor: t.colors.surfaceAlt }} accessibilityRole="tablist">
      {options.map(([k, l]) => (
        <Tap key={k} onPress={() => onChange(k)} accessibilityRole="tab" accessibilityState={{ selected: value === k }}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm, backgroundColor: value === k ? t.colors.surface : 'transparent' }}>
          <Txt v="label" color={value === k ? t.colors.text : t.colors.textMuted} numberOfLines={1}>{l}</Txt>
        </Tap>
      ))}
    </View>
  );
}

export function ListRow({ title, meta, right, onPress, icon }: { title: string; meta?: string; right?: ReactNode; onPress?: () => void; icon?: IconName }) {
  const t = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
      {icon && <Icon name={icon} size={20} color={t.colors.accentText} />}
      <View style={{ flex: 1 }}><Txt v="title" numberOfLines={2}>{title}</Txt>{meta ? <Txt v="caption" muted numberOfLines={2}>{meta}</Txt> : null}</View>
      {right}
    </View>
  );
  return onPress ? <Tap onPress={onPress} scaleTo={0.99} accessibilityRole="button">{body}</Tap> : body;
}

export const go = (path: string) => router.push(path as never);
export const when = (iso: string | null, te: boolean) =>
  iso ? new Date(iso).toLocaleString(te ? 'te-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
