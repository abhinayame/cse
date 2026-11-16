import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Icon, Tap, Txt } from '@/components/ui';
import { districtById, placeName } from '@/data/locations';
import { pick } from '@/lib/text';
import { compact } from '@/lib/time';
import { haptic } from '@/lib/haptics';
import { useT } from '@/i18n';
import { categoryColors, palette, radius } from '@/theme';
import type { VideoStory } from '@/data/types';
import { Share } from 'react-native';
import { APP } from '@/config';

interface Props { video: VideoStory; active: boolean; width: number; height: number; muted: boolean; onToggleMute: () => void; lang: string; bottomInset: number; autoplay: boolean }

export function VideoItem({ video, active, width, height, muted, onToggleMute, lang, bottomInset, autoplay }: Props) {
  const tr = useT();
  const [liked, setLiked] = useState(false);
  const [paused, setPaused] = useState(false);
  const player = useVideoPlayer(video.uri, (p) => { p.loop = true; p.muted = muted; p.timeUpdateEventInterval = 0.5; });
  const time = useEvent(player, 'timeUpdate', { currentTime: 0, currentLiveTimestamp: null, currentOffsetFromLive: null, bufferedPosition: 0 });
  const status = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => {
    if (active && autoplay && !paused) player.play(); else player.pause();
    if (!active) { player.currentTime = 0; setPaused(false); }
  }, [active, autoplay, paused, player]);

  const sub = [...video.subtitles].reverse().find((s) => (time?.currentTime ?? 0) >= s.at);
  const l = (video.caption as Record<string, string>)[lang] ? lang : 'en';
  const progress = Math.min(1, (time?.currentTime ?? 0) / video.durationSec);

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      <Image source={{ uri: video.poster }} style={{ position: 'absolute', width, height }} contentFit="cover" />
      <VideoView player={player} style={{ position: 'absolute', width, height }} contentFit="cover" nativeControls={false} />
      <Tap haptics={false} scaleTo={1} onPress={() => setPaused((p) => !p)} style={{ position: 'absolute', width, height }} accessibilityLabel={paused ? 'Play' : 'Pause'}>
        {(paused || (!autoplay && !player.playing)) && (
          <Animated.View entering={ZoomIn} exiting={FadeOut} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="play" size={34} color={palette.white} />
            </View>
          </Animated.View>
        )}
      </Tap>
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']} locations={[0, 0.2, 0.55, 1]} style={{ position: 'absolute', width, height }} />

      {status?.status === 'loading' && active && (
        <View pointerEvents="none" style={{ position: 'absolute', top: height / 2 - 1, left: width / 2 - 30, width: 60, height: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
      )}

      {/* action rail */}
      <View style={{ position: 'absolute', right: 12, bottom: bottomInset + 100, alignItems: 'center', gap: 20 }}>
        <RailBtn icon={liked ? 'heart' : 'heart-outline'} color={liked ? palette.red : palette.white} label={compact(video.likes + (liked ? 1 : 0))} onPress={() => { setLiked(!liked); haptic.success(); }} />
        <RailBtn icon="logo-whatsapp" label={compact(video.shares)} onPress={() => Share.share({ message: `${pick(video.caption, lang)}\n${APP.shareBase}v/${video.id}` })} />
        {video.storyId && <RailBtn icon="newspaper-outline" label={tr('readFull').split(' ')[0]} onPress={() => router.push(`/story/${video.storyId}`)} />}
        <RailBtn icon={muted ? 'volume-mute' : 'volume-high'} label="" onPress={onToggleMute} />
      </View>

      {/* captions + meta */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 18, right: 84, bottom: bottomInset + 24, gap: 10 }}>
        {sub && (
          <Animated.View key={sub.at} entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.sm }}>
            <Txt v="title" lang={l} color={palette.white}>{pick(sub.text, lang)}</Txt>
          </Animated.View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: categoryColors[video.category] }} />
          <Txt v="label" color={palette.redSoft}>{tr(`cat_${video.category}`)} · {placeName(lang, districtById(video.districtId))}</Txt>
        </View>
        <Txt v="h3" lang={l} color={palette.white} numberOfLines={3}>{pick(video.caption, lang)}</Txt>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: 3, backgroundColor: palette.red }} />
        </View>
      </View>
    </View>
  );
}

function RailBtn({ icon, label, onPress, color = palette.white }: { icon: React.ComponentProps<typeof Icon>['name']; label: string; onPress: () => void; color?: string }) {
  return (
    <Tap onPress={onPress} scaleTo={0.85} accessibilityLabel={label || icon} style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={26} color={color} />
      </View>
      {label ? <Txt v="caption" color={palette.white} style={{ fontSize: 11 }}>{label}</Txt> : null}
    </Tap>
  );
}
