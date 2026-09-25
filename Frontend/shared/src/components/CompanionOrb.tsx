import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

import { tokens } from '../design';

export type CompanionMood = 'idle' | 'attentive' | 'thinking' | 'charging';

export interface CompanionOrbProps {
  readonly size?: number;
  readonly mood?: CompanionMood;
}

const [iris, sky, mint, amber, ember, rose] = tokens.aurora as unknown as readonly [
  string,
  string,
  string,
  string,
  string,
  string,
];

/**
 * Worthy's body: an iridescent sphere whose colours slowly orbit inside it, with a lens for an
 * eye. It breathes at rest, blinks now and then, and glances around; when attentive the lens
 * widens, when thinking the colours race. Every loop is transform-only on the UI thread.
 */
export function CompanionOrb({ size = 60, mood = 'idle' }: CompanionOrbProps) {
  const reduceMotion = useReducedMotion();
  const spinA = useSharedValue(0);
  const spinB = useSharedValue(0);
  const breath = useSharedValue(0);
  const blink = useSharedValue(1);
  const glance = useSharedValue(0);
  const focus = useSharedValue(0);

  // Ambient loops: two colour layers counter-rotating, and a slow breath.
  useEffect(() => {
    if (reduceMotion) return;
    const fast = mood === 'thinking' || mood === 'charging';
    spinA.value = withRepeat(
      withTiming(spinA.value + 360, { duration: fast ? 1400 : 9000, easing: Easing.linear }),
      -1,
    );
    spinB.value = withRepeat(
      withTiming(spinB.value - 360, { duration: fast ? 2000 : 13000, easing: Easing.linear }),
      -1,
    );
    breath.value = withRepeat(
      withTiming(1, { duration: fast ? 600 : 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(spinA);
      cancelAnimation(spinB);
      cancelAnimation(breath);
    };
  }, [breath, mood, reduceMotion, spinA, spinB]);

  // Blinks and glances on an irregular rhythm so it never feels mechanical.
  useEffect(() => {
    if (reduceMotion) return;
    blink.value = withRepeat(
      withSequence(
        withDelay(3800, withTiming(0.08, { duration: 70 })),
        withTiming(1, { duration: 110 }),
        withDelay(160, withTiming(0.08, { duration: 60 })),
        withTiming(1, { duration: 120 }),
        withDelay(5200, withTiming(1, { duration: 1 })),
      ),
      -1,
    );
    glance.value = withRepeat(
      withSequence(
        withDelay(2200, withSpring(1, tokens.motion.spring.gentle)),
        withDelay(1600, withSpring(-1, tokens.motion.spring.gentle)),
        withDelay(1800, withSpring(0, tokens.motion.spring.gentle)),
      ),
      -1,
    );
    return () => {
      cancelAnimation(blink);
      cancelAnimation(glance);
    };
  }, [blink, glance, reduceMotion]);

  useEffect(() => {
    focus.value = withSpring(mood === 'idle' ? 0 : 1, tokens.motion.spring.playful);
  }, [focus, mood]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.035 + focus.value * 0.06 }],
  }));
  const layerA = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinA.value}deg` }] }));
  const layerB = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinB.value}deg` }] }));
  const lensStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: glance.value * size * 0.06 },
      { translateY: interpolate(Math.abs(glance.value), [0, 1], [0, -size * 0.02]) },
      { scale: 1 + focus.value * 0.12 },
      { scaleY: blink.value },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + breath.value * 0.25 + focus.value * 0.25,
    transform: [{ scale: 1.15 + breath.value * 0.12 + focus.value * 0.1 }],
  }));

  const lens = size * 0.4;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.55" stopColor={iris} stopOpacity={0.5} />
              <Stop offset="1" stopColor={rose} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#halo)" />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[styles.body, { width: size, height: size, borderRadius: size / 2 }, bodyStyle]}
      >
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="base" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={iris} />
              <Stop offset="0.5" stopColor={rose} />
              <Stop offset="1" stopColor={ember} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#base)" />
        </Svg>
        <Animated.View style={[StyleSheet.absoluteFill, layerA]}>
          <Blob size={size} color={sky} x={0.28} y={0.3} r={0.42} id="a" />
          <Blob size={size} color={amber} x={0.78} y={0.72} r={0.36} id="b" />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, layerB]}>
          <Blob size={size} color={mint} x={0.3} y={0.78} r={0.34} id="c" />
          <Blob size={size} color={iris} x={0.74} y={0.24} r={0.3} id="d" />
        </Animated.View>
        {/* Glass sheen: a soft highlight top-left and a shade bottom-right. */}
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="sheen" cx="32%" cy="26%" r="46%">
              <Stop offset="0" stopColor="white" stopOpacity={0.75} />
              <Stop offset="0.4" stopColor="white" stopOpacity={0.12} />
              <Stop offset="1" stopColor="white" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="shade" cx="72%" cy="84%" r="60%">
              <Stop offset="0" stopColor="black" stopOpacity={0.25} />
              <Stop offset="1" stopColor="black" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#shade)" />
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#sheen)" />
        </Svg>
        <View style={styles.center}>
          <Animated.View
            style={[
              styles.lens,
              {
                width: lens,
                height: lens,
                borderRadius: lens / 2,
                borderWidth: Math.max(2, size * 0.035),
              },
              lensStyle,
            ]}
          >
            <View
              style={[
                styles.glint,
                {
                  width: lens * 0.26,
                  height: lens * 0.26,
                  borderRadius: lens,
                  top: lens * 0.16,
                  right: lens * 0.16,
                },
              ]}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

function Blob({
  size,
  color,
  x,
  y,
  r,
  id,
}: {
  readonly size: number;
  readonly color: string;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly id: string;
}) {
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={`blob-${id}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.95} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size * x} cy={size * y} r={size * r} fill={`url(#blob-${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  body: {
    overflow: 'hidden',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lens: {
    backgroundColor: tokens.color.dark.canvas,
    borderColor: tokens.overlay.text,
  },
  glint: {
    position: 'absolute',
    backgroundColor: tokens.overlay.text,
  },
});
