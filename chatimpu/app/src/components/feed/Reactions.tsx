import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Tap, Txt } from '@/components/ui';
import { useLibrary } from '@/store/library';
import { compact } from '@/lib/time';
import { haptic } from '@/lib/haptics';
import { radius, shadow, useTheme } from '@/theme';
import type { ReactionKind, Story } from '@/data/types';

export const EMOJI: Record<ReactionKind, string> = { like: '👍', wow: '😮', sad: '😢', angry: '😡' };

/** Tap = 👍, long-press = picker with 👍 😮 😢 😡 */
export function ReactionButton({ story }: { story: Story }) {
  const t = useTheme();
  const mine = useLibrary((s) => s.reactions[story.id]);
  const react = useLibrary((s) => s.react);
  const [open, setOpen] = useState(false);
  const total = Object.values(story.reactions).reduce((a, b) => a + b, 0) + (mine ? 1 : 0);

  return (
    <View>
      {open && (
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          exiting={FadeOut.duration(120)}
          style={[{ position: 'absolute', bottom: 48, left: -6, flexDirection: 'row', gap: 4, padding: 6, borderRadius: radius.pill, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border, zIndex: 20 }, shadow.lift]}
        >
          {(Object.keys(EMOJI) as ReactionKind[]).map((k) => (
            <Tap key={k} scaleTo={1.25} onPress={() => { react(story.id, k); haptic.success(); setOpen(false); }} accessibilityLabel={k}
              style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: mine === k ? t.colors.surfaceAlt : 'transparent' }}>
              <Txt style={{ fontSize: 24, lineHeight: 30 }}>{EMOJI[k]}</Txt>
            </Tap>
          ))}
        </Animated.View>
      )}
      <Tap
        onPress={() => (open ? setOpen(false) : react(story.id, 'like'))}
        onLongPress={() => { haptic.heavy(); setOpen(true); }}
        accessibilityLabel="React"
        accessibilityHint="Long press for more reactions"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: mine ? t.colors.surfaceAlt : 'transparent', borderWidth: 1, borderColor: t.colors.border }}
      >
        <Animated.Text key={mine ?? 'none'} entering={FadeIn} style={{ fontSize: 16 }}>{EMOJI[mine ?? 'like']}</Animated.Text>
        <Txt v="label" muted>{compact(total)}</Txt>
      </Tap>
    </View>
  );
}
