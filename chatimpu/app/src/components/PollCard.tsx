import { useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';
import { Icon, Tap, Txt } from '@/components/ui';
import { useLibrary } from '@/store/library';
import { usePrefs } from '@/store/prefs';
import { votePoll } from '@/lib/api';
import { pick } from '@/lib/text';
import { compact } from '@/lib/time';
import { haptic } from '@/lib/haptics';
import { districtById, placeName } from '@/data/locations';
import { useT } from '@/i18n';
import { motion, radius, shadow, useTheme } from '@/theme';
import type { Poll } from '@/data/types';

/** Poll with live results by district vs nationwide. */
export function PollCard({ poll }: { poll: Poll }) {
  const t = useTheme();
  const tr = useT();
  const { language: lang, districtId } = usePrefs();
  const mine = useLibrary((s) => s.pollVotes[poll.id]);
  const vote = useLibrary((s) => s.vote);
  const [scope, setScope] = useState<'district' | 'national'>('district');
  const key = scope === 'national' ? 'national' : districtId;
  const base = poll.votes[key] ?? {};
  const counts = Object.fromEntries(poll.options.map((o) => [o.id, (base[o.id] ?? 0) + (mine === o.id ? 1 : 0)]));
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const hrsLeft = Math.max(0, Math.round((new Date(poll.closesAt).getTime() - Date.now()) / 3_600_000));
  const qLang = (poll.question as Record<string, string>)[lang] ? lang : 'en';

  const onVote = async (id: string) => {
    if (mine) return;
    vote(poll.id, id);
    haptic.success();
    votePoll(poll.id, id, districtId).catch(() => {});
  };

  return (
    <View style={[{ marginHorizontal: 20, padding: 18, borderRadius: radius.lg, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, gap: 12 }, shadow.soft]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="stats-chart" size={14} color={t.colors.accentText} />
        <Txt v="overline" color={t.colors.accentText}>{tr('polls')}</Txt>
        <View style={{ flex: 1 }} />
        <Txt v="caption" muted>{hrsLeft}h · {tr('votes', { n: compact(total) })}</Txt>
      </View>
      <Txt v="h3" lang={qLang}>{pick(poll.question, lang)}</Txt>
      {poll.options.map((o, i) => {
        const pct = Math.round((counts[o.id] / total) * 100);
        const sel = mine === o.id;
        return (
          <Tap key={o.id} onPress={() => onVote(o.id)} disabled={!!mine} accessibilityRole="button" accessibilityLabel={`${pick(o.label, lang)}${mine ? `, ${pct}%` : ''}`}
            style={{ height: 48, borderRadius: radius.md, overflow: 'hidden', borderWidth: sel ? 2 : 1, borderColor: sel ? t.colors.accent : t.colors.border, justifyContent: 'center' }}>
            {mine && <Bar pct={pct} delay={i * 80} color={sel ? t.colors.accent : t.colors.surfaceAlt} strong={sel} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }}>
              <Txt v="title" lang={qLang} style={{ flex: 1 }} numberOfLines={1}>{pick(o.label, lang)}</Txt>
              {mine && <Txt v="title" lang="en">{pct}%</Txt>}
            </View>
          </Tap>
        );
      })}
      {mine && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
          {(['district', 'national'] as const).map((s) => (
            <Tap key={s} onPress={() => setScope(s)} style={{ paddingHorizontal: 12, height: 30, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: scope === s ? t.colors.text : t.colors.surfaceAlt }}>
              <Txt v="caption" color={scope === s ? t.colors.bg : t.colors.text}>{s === 'district' ? `${tr('yourDistrict')} · ${placeName(lang, districtById(districtId))}` : tr('nationwide')}</Txt>
            </Tap>
          ))}
        </View>
      )}
    </View>
  );
}

function Bar({ pct, delay, color, strong }: { pct: number; delay: number; color: string; strong: boolean }) {
  const a = useAnimatedStyle(() => ({ transform: [{ scaleX: withDelay(delay, withSpring(Math.max(pct, 1) / 100, motion.spring)) }] }), [pct]);
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', transformOrigin: 'left', backgroundColor: color, opacity: strong ? 0.35 : 1 }, a]} />;
}
