import { useRef, useState, type ComponentRef } from 'react';
import { TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Button, Tap, Txt } from '@/components/ui';
import { sendOtp, verifyOtp, DEMO_OTP } from '@/lib/api';
import { isDemoMode } from '@/lib/supabase';
import { usePrefs } from '@/store/prefs';
import { useT } from '@/i18n';
import { radius, useTheme } from '@/theme';
import { haptic } from '@/lib/haptics';

/** Phone + 6-digit OTP. Uses Supabase Auth (SMS) when configured, a demo code otherwise. */
export function OtpLogin({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const tr = useT();
  const set = usePrefs((s) => s.set);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);

  const send = async () => {
    setBusy(true); setErr(null);
    try { await sendOtp(phone); setStage('code'); setTimeout(() => codeRef.current?.focus(), 250); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const verify = async (c = code) => {
    setBusy(true); setErr(null);
    try { const user = await verifyOtp(phone, c); set({ user }); haptic.success(); onDone(); }
    catch (e) { setErr((e as Error).message); haptic.heavy(); } finally { setBusy(false); }
  };

  const inputStyle = { height: 58, borderRadius: radius.md, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surface, color: t.colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 20 };

  return (
    <View style={{ gap: 14 }}>
      {stage === 'phone' ? (
        <Animated.View key="p" entering={FadeInDown} exiting={FadeOut} style={{ gap: 14 }}>
          <Txt v="label" muted>{tr('phoneNumber')}</Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={[inputStyle, { width: 72, alignItems: 'center', justifyContent: 'center' }]}><Txt v="title" lang="en">🇮🇳 +91</Txt></View>
            <TextInput value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="98765 43210"
              placeholderTextColor={t.colors.textFaint} accessibilityLabel={tr('phoneNumber')} style={[inputStyle, { flex: 1, paddingHorizontal: 16, letterSpacing: 1 }]} />
          </View>
          <Button label={tr('sendOtp')} disabled={phone.length !== 10} loading={busy} onPress={send} />
        </Animated.View>
      ) : (
        <Animated.View key="c" entering={FadeInDown} style={{ gap: 14 }}>
          <Txt v="label" muted>{tr('enterOtp')} · {tr('otpSentTo', { phone })}</Txt>
          <Tap onPress={() => codeRef.current?.focus()} haptics={false} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={[inputStyle, { width: '14.5%', alignItems: 'center', justifyContent: 'center', borderColor: i === code.length ? t.colors.accent : t.colors.border, borderWidth: i === code.length ? 2 : 1 }]}>
                <Txt v="h2" lang="en">{code[i] ?? ''}</Txt>
              </View>
            ))}
          </Tap>
          <TextInput ref={codeRef} value={code} autoComplete="sms-otp" textContentType="oneTimeCode" keyboardType="number-pad" accessibilityLabel={tr('enterOtp')}
            onChangeText={(v) => { const c = v.replace(/\D/g, '').slice(0, 6); setCode(c); if (c.length === 6) verify(c); }}
            style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }} />
          {isDemoMode && <Txt v="caption" muted>Demo mode: use code {DEMO_OTP}</Txt>}
          <Button label={tr('verify')} disabled={code.length !== 6} loading={busy} onPress={() => verify()} />
          <Tap onPress={send}><Txt v="label" color={t.colors.accentText} align="center">{tr('resend')}</Txt></Tap>
        </Animated.View>
      )}
      {err && <Txt v="bodySm" color={t.colors.breakingText}>{err}</Txt>}
    </View>
  );
}
