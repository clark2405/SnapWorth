import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { tokens, useTheme } from '../design';

export type AmbientArea = keyof typeof tokens.ambient.light;

export interface AmbientBackdropProps {
  /**
   * Which area's tint the blobs take, so each tab feels a little different while the base and
   * accent stay constant. `none` is only for screens over live media.
   */
  readonly mood?: AmbientArea | 'none';
}

/** Where each blob rests, as fractions of the screen, and how far it wanders. */
const blobs = [
  { x: -0.35, y: -0.18, size: 1.3, driftX: 0.08, driftY: 0.05, phase: 0 },
  { x: 0.35, y: 0.18, size: 1.1, driftX: -0.1, driftY: 0.06, phase: 0.33 },
  { x: -0.2, y: 0.55, size: 1.2, driftX: 0.07, driftY: -0.05, phase: 0.66 },
] as const;

/**
 * No screen is ever fully static: two or three huge, soft, warm blobs drift and breathe behind
 * the content on a slow loop. Each blob is one pre-rendered soft disc moved by transform and
 * opacity only, so it costs nothing per frame on the JS thread; under reduced motion it holds.
 */
export function AmbientBackdrop({ mood = 'calm' }: AmbientBackdropProps) {
  const { name } = useTheme();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || mood === 'none') return;
    breath.value = withRepeat(
      withTiming(1, {
        duration: tokens.motion.duration.ambientLoop,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(breath);
  }, [breath, mood, reduceMotion]);

  if (mood === 'none') return null;

  const tints = tokens.ambient[name][mood];
  const peak = tokens.motion.ambient.peakOpacity[name];

  return (
    <View style={styles.layer}>
      {blobs.map((blob, index) => (
        <Blob
          key={index}
          index={index}
          tint={tints[index] ?? ''}
          peak={peak}
          breath={breath}
          width={width}
          height={height}
          {...blob}
        />
      ))}
    </View>
  );
}

function Blob({
  index,
  tint,
  peak,
  breath,
  width,
  height,
  x,
  y,
  size,
  driftX,
  driftY,
  phase,
}: {
  readonly index: number;
  readonly tint: string;
  readonly peak: number;
  readonly breath: SharedValue<number>;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly driftX: number;
  readonly driftY: number;
  readonly phase: number;
}) {
  const reduceMotion = useReducedMotion();
  const offset = useSharedValue(phase);
  const diameter = width * size;

  // Each blob runs its own loop, started part-way through, so they never move in lockstep.
  useEffect(() => {
    if (reduceMotion) return;
    offset.value = phase;
    offset.value = withDelay(
      phase * tokens.motion.duration.ambientLoop,
      withRepeat(
        withTiming(phase + 1, {
          duration: tokens.motion.duration.ambientLoop * 1.6,
          easing: Easing.inOut(Easing.sin),
        }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(offset);
  }, [offset, phase, reduceMotion]);

  const style = useAnimatedStyle(() => {
    const wander = Math.sin(offset.value * Math.PI);
    return {
      opacity: peak * (0.7 + breath.value * 0.3),
      transform: [
        { translateX: width * (x + wander * driftX) },
        { translateY: height * y + width * wander * driftY },
        { scale: 0.92 + breath.value * 0.12 },
      ],
    };
  });

  const id = `ambient-${index}`;
  return (
    <Animated.View style={[styles.blob, { width: diameter, height: diameter }, style]}>
      <Svg width={diameter} height={diameter}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={tint} stopOpacity={1} />
            <Stop offset="0.55" stopColor={tint} stopOpacity={0.55} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={diameter / 2} cy={diameter / 2} r={diameter / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  blob: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
