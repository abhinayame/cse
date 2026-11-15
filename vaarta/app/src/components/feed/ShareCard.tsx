import { forwardRef, type ComponentRef } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Txt } from '@/components/ui';
import { categoryColors, palette } from '@/theme';
import { storyText } from '@/lib/text';
import { districtById, placeName } from '@/data/locations';
import { translate } from '@/i18n';
import type { LangCode } from '@/i18n/languages';
import type { Story } from '@/data/types';
import { APP } from '@/config';

/** Branded 1080×1350 (4:5) share template for WhatsApp / Instagram. Rendered at 360×450 and captured at 3×. */
export const ShareCard = forwardRef<ComponentRef<typeof View>, { story: Story; lang: LangCode }>(function ShareCard({ story, lang }, ref) {
  const txt = storyText(story, lang);
  return (
    <View ref={ref} collapsable={false} style={{ width: 360, height: 450, backgroundColor: palette.midnight }}>
      <Image source={{ uri: story.image }} style={{ width: 360, height: 220 }} contentFit="cover" />
      <LinearGradient colors={['rgba(11,18,32,0)', palette.midnight]} style={{ position: 'absolute', top: 120, width: 360, height: 100 }} />
      <View style={{ position: 'absolute', top: 14, left: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: palette.gold, alignItems: 'center', justifyContent: 'center' }}>
          <Txt v="title" lang="en" color={palette.midnight} style={{ fontFamily: 'PlayfairDisplay_700Bold', fontSize: 15, lineHeight: 18 }}>{APP.name[0]}</Txt>
        </View>
        <Txt v="title" lang="en" color={palette.ivory} style={{ fontFamily: 'PlayfairDisplay_700Bold' }}>{APP.name}</Txt>
      </View>
      <View style={{ padding: 18, paddingTop: 4, flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: categoryColors[story.category] }} />
          <Txt v="overline" lang={lang} color={palette.gold}>{translate(lang, `cat_${story.category}`)} · {placeName(lang, districtById(story.districtId))}</Txt>
        </View>
        <Txt v="h3" lang={txt.lang} color={palette.ivory} numberOfLines={3}>{txt.headline}</Txt>
        <Txt v="caption" lang={txt.lang} color="#C9CFDB" numberOfLines={5} style={{ marginTop: 8 }}>{txt.summary}</Txt>
        <View style={{ flex: 1 }} />
        <View style={{ height: 1, backgroundColor: 'rgba(201,162,77,0.4)', marginBottom: 8 }} />
        <Txt v="caption" lang="en" color={palette.goldSoft}>Read more short news in your language · {APP.domain}</Txt>
      </View>
    </View>
  );
});
