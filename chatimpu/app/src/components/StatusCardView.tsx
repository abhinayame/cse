/** A 9:16 WhatsApp-status card. Rendered on screen and captured at 1080×1920 for sharing. */
import { forwardRef, type ComponentRef } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt } from '@/components/ui';
import { Emblem } from '@/components/Brand';
import { palette } from '@/theme';
import { TE_BOLD } from '@/theme/fonts';
import { APP } from '@/config';
import { STATUS_BACKGROUNDS, STATUS_KIND_LABEL, type StatusCard } from '@/data/status';

export const StatusCardView = forwardRef<ComponentRef<typeof View>, { card: StatusCard; width: number }>(function StatusCardView({ card, width }, ref) {
  const height = Math.round(width * 16 / 9);
  const s = width / 360; // scale typography with the card
  const [a, b] = STATUS_BACKGROUNDS[card.background] ?? STATUS_BACKGROUNDS.saffron;
  const te = card.lang === 'te';
  const long = card.text.length > 120;
  return (
    <View ref={ref} collapsable={false} style={{ width, height, overflow: 'hidden', backgroundColor: a }}>
      {card.image ? <Image source={{ uri: card.image }} style={{ position: 'absolute', width, height }} contentFit="cover" />
        : <LinearGradient colors={[a, b]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', width, height }} />}
      {card.image && <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={{ position: 'absolute', width, height }} />}
      <View style={{ position: 'absolute', top: 22 * s, left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * s, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 10 * s, paddingVertical: 4 * s, borderRadius: 20 * s }}>
          <Emblem size={22 * s} />
          <Txt lang="en" style={{ fontFamily: TE_BOLD, fontSize: 15 * s, lineHeight: 26 * s, color: palette.navy }}>{APP.nameTe}</Txt>
        </View>
      </View>
      {card.kind !== 'meme' || !card.image ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 * s }}>
          <Txt lang="en" style={{ alignSelf: 'center', fontSize: 12 * s, lineHeight: 18 * s, color: 'rgba(255,255,255,0.85)', fontFamily: te ? TE_BOLD : 'Inter_700Bold', letterSpacing: te ? 0 : 2 * s, marginBottom: 14 * s }}>
            {(te ? STATUS_KIND_LABEL[card.kind].te : STATUS_KIND_LABEL[card.kind].en.toUpperCase())}
          </Txt>
          <Txt lang={card.lang} align="center" style={{ fontFamily: te ? TE_BOLD : 'PlayfairDisplay_700Bold', fontSize: (long ? 22 : 28) * s, lineHeight: (long ? (te ? 40 : 32) : (te ? 50 : 38)) * s, color: palette.white, textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 }}>
            {card.text}
          </Txt>
          {card.attribution && <Txt lang={card.lang} align="center" style={{ marginTop: 16 * s, fontSize: 14 * s, lineHeight: 24 * s, color: 'rgba(255,255,255,0.85)' }}>— {card.attribution}</Txt>}
        </View>
      ) : <View style={{ flex: 1 }} />}
      <Txt lang="en" align="center" style={{ position: 'absolute', bottom: 18 * s, left: 0, right: 0, fontSize: 12 * s, lineHeight: 16 * s, color: 'rgba(255,255,255,0.9)', fontFamily: 'Inter_600SemiBold' }}>www.{APP.domain}</Txt>
    </View>
  );
});
