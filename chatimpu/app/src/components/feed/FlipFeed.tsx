/**
 * Vertical 3D page-flip pager (Flipboard-style).
 *
 * Every page is drawn as two halves. A single continuous shared value `pos` (float page index)
 * drives every half, so committing a flip never re-renders visible content → no flicker.
 *
 *  flipping k → k+1 at fraction f:
 *    bottom(k)   rotates up 0→90° around the centre line   (f < .5)
 *    top(k+1)    rotates down 90→0° onto the top half       (f ≥ .5)
 *    bottom(k+1) and top(k) are static underneath
 *
 * Bottom halves are stacked lowest-index-on-top, top halves highest-index-on-top.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState, type ReactNode } from 'react';
import { AccessibilityActionEvent, StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { haptic } from '@/lib/haptics';

const PERSPECTIVE = 2200;
const WINDOW = 2;

export interface FlipFeedHandle { goTo: (i: number) => void }

interface Props<T> {
  items: T[];
  keyOf: (t: T) => string;
  render: (t: T, index: number, active: boolean) => ReactNode;
  width: number;
  height: number;
  onIndexChange?: (i: number, prev: number) => void;
}

function FlipFeedInner<T>({ items, keyOf, render, width, height, onIndexChange }: Props<T>, ref: React.Ref<FlipFeedHandle>) {
  const pos = useSharedValue(0);
  const start = useSharedValue(0);
  const count = useSharedValue(items.length);
  const [index, setIndex] = useState(0);

  useEffect(() => { count.value = items.length; }, [items.length, count]);

  const settle = useCallback((i: number) => {
    setIndex((prev) => {
      if (prev !== i) { haptic.flip(); onIndexChange?.(i, prev); }
      return i;
    });
  }, [onIndexChange]);

  const animateTo = useCallback((i: number) => {
    const target = Math.max(0, Math.min(items.length - 1, i));
    pos.value = withSpring(target, { damping: 26, stiffness: 190, mass: 1, overshootClamping: true }, (done) => {
      if (done) scheduleOnRN(settle, target);
    });
  }, [items.length, pos, settle]);

  useImperativeHandle(ref, () => ({
    goTo: (i: number) => {
      if (i === 0 && index > 3) { pos.value = 0; settle(0); } else animateTo(i);
    },
  }), [animateTo, index, pos, settle]);

  const pan = usePanGesture({
    activeOffsetY: [-12, 12],
    failOffsetX: [-28, 28],
    onActivate: () => {
      'worklet';
      start.value = pos.value;
    },
    onUpdate: (e) => {
      'worklet';
      const travel = height * 0.72;
      let p = start.value - e.translationY / travel;
      const max = count.value - 1;
      // never move more than one page per gesture; rubber-band at both ends
      p = Math.max(start.value - 1, Math.min(start.value + 1, p));
      if (p < 0) p = p * 0.25;
      if (p > max) p = max + (p - max) * 0.25;
      pos.value = p;
    },
    onDeactivate: (e) => {
      'worklet';
      const v = -e.velocityY / (height * 0.72);
      const projected = pos.value + v * 0.18;
      const base = start.value;
      let target = projected > base + 0.32 ? base + 1 : projected < base - 0.32 ? base - 1 : base;
      target = Math.max(0, Math.min(count.value - 1, Math.round(target)));
      pos.value = withSpring(target, { damping: 26, stiffness: 190, mass: 1, overshootClamping: true }, (done) => {
        if (done) scheduleOnRN(settle, target);
      });
    },
  });

  const from = Math.max(0, index - WINDOW);
  const to = Math.min(items.length - 1, index + WINDOW);
  const mounted: number[] = [];
  for (let i = from; i <= to; i++) mounted.push(i);

  const onA11y = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') animateTo(index + 1);
    if (e.nativeEvent.actionName === 'decrement') animateTo(index - 1);
  };

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{ width, height, overflow: 'hidden' }}
        accessible={false}
        accessibilityActions={[{ name: 'increment', label: 'Next story' }, { name: 'decrement', label: 'Previous story' }]}
        onAccessibilityAction={onA11y}
      >
        {/* bottom halves: lowest index on top → render descending */}
        {[...mounted].reverse().map((i) => (
          <Half key={`b-${keyOf(items[i])}`} i={i} half="bottom" active={i === index} pos={pos} width={width} height={height}>
            {render(items[i], i, i === index)}
          </Half>
        ))}
        {/* top halves: highest index on top → render ascending */}
        {mounted.map((i) => (
          <Half key={`t-${keyOf(items[i])}`} i={i} half="top" active={i === index} pos={pos} width={width} height={height}>
            {render(items[i], i, i === index)}
          </Half>
        ))}
      </View>
    </GestureDetector>
  );
}

export const FlipFeed = forwardRef(FlipFeedInner) as <T>(p: Props<T> & { ref?: React.Ref<FlipFeedHandle> }) => ReturnType<typeof FlipFeedInner>;

interface HalfProps { i: number; active: boolean; half: 'top' | 'bottom'; pos: SharedValue<number>; width: number; height: number; children: ReactNode }

function Half({ i, active, half, pos, width, height, children }: HalfProps) {
  const hh = height / 2;
  const isTop = half === 'top';

  const panel = useAnimatedStyle(() => {
    const r = i - pos.value;
    let angle = 0;
    let visible: boolean;
    if (isTop) {
      if (r <= 0) visible = r > -1.0001; // current / just passed: static
      else {
        const f = 1 - r; // incoming page: falls from 90° to 0° during second half
        visible = f >= 0.5 && r < 1;
        angle = -(1 - f) * 180;
      }
    } else {
      if (r >= 0) visible = r < 1.0001; // current / next: static
      else {
        const f = -r; // outgoing page: lifts 0° → 90° during first half
        visible = f < 0.5 && r > -1;
        angle = Math.min(f * 180, 90);
      }
    }
    return {
      opacity: visible ? 1 : 0,
      transform: [{ perspective: PERSPECTIVE }, { rotateX: `${angle}deg` }],
    };
  });

  const shade = useAnimatedStyle(() => {
    const r = i - pos.value;
    let o = 0;
    if (isTop && r > 0 && r < 1) o = interpolate(r, [0, 0.5], [0, 0.45], Extrapolation.CLAMP);
    if (!isTop && r < 0 && r > -1) o = interpolate(-r, [0, 0.5], [0, 0.5], Extrapolation.CLAMP);
    if (!isTop && r > 0 && r < 1) o = interpolate(r, [0.5, 1], [0, 0.55], Extrapolation.CLAMP); // revealed page under a lifting half
    if (isTop && r < 0 && r > -1) o = interpolate(-r, [0, 0.5], [0, 0.35], Extrapolation.CLAMP); // page about to be covered
    return { opacity: o };
  });

  return (
    <Animated.View
      pointerEvents={active ? 'box-none' : 'none'}
      style={[
        styles.half,
        { top: isTop ? 0 : hh, width, height: hh, transformOrigin: isTop ? 'bottom' : 'top' },
        panel,
      ]}
    >
      <View style={{ position: 'absolute', top: isTop ? 0 : -hh, width, height }}>{children}</View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, shade]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  half: { position: 'absolute', left: 0, overflow: 'hidden', backfaceVisibility: 'hidden' },
});
