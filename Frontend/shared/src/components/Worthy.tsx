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
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

import { tokens, useTheme } from '../design';
import { worthyBodyPath } from './brand-paths';

export type CompanionMood = 'idle' | 'attentive' | 'thinking' | 'charging';

export interface WorthyProps {
  readonly size?: number;
  readonly mood?: CompanionMood;
}

// Drawn in a square box a little larger than the tag, so the string curl above it fits.
const box = { x: -6, y: -10, size: 112 };
const eye = { x: 50, y: 39, ring: 13, pupil: 9.6 };
// Ink and cream are the same in both appearances: Worthy looks like Worthy at night too.
const ink = tokens.color.light.textPrimary;
const cream = tokens.color.dark.textPrimary;

/**
 * Worthy, the SnapWorth mascot: the logo's price tag come to life, its eyelet a camera lens for
 * an eye. It sways and breathes at rest, blinks now and then and glances around; attentive, the
 * eye widens; thinking, it wobbles in quick little beats. Every loop is transform-only on the UI
 * thread, and reduced motion keeps it still.
 */
export function Worthy({ size = 60, mood = 'idle' }: WorthyProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const breath = useSharedValue(0);
  const sway = useSharedValue(0);
  const blink = useSharedValue(1);
  const glance = useSharedValue(0);
  const focus = useSharedValue(0);
  const unit = size / box.size;

  // A slow breath and a hang-tag sway; both quicken while it works something out.
  useEffect(() => {
    if (reduceMotion) return;
    const busy = mood === 'thinking' || mood === 'charging';
    breath.value = withRepeat(
      withTiming(1, { duration: busy ? 520 : 3200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    sway.value = withRepeat(
      withSequence(
        withTiming(1, { duration: busy ? 180 : 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: busy ? 180 : 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    return () => {
      cancelAnimation(breath);
      cancelAnimation(sway);
    };
  }, [breath, mood, reduceMotion, sway]);

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
    transform: [
      // Hung from its string: it pivots near the top, not the middle.
      { translateY: -size * 0.3 },
      { rotate: `${-6 + sway.value * (mood === 'thinking' ? 4 : 3)}deg` },
      { translateY: size * 0.3 },
      { scaleX: 1 + breath.value * 0.02 + focus.value * 0.04 },
      { scaleY: 1 + breath.value * 0.035 + focus.value * 0.06 },
    ],
  }));
  const eyeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: glance.value * size * 0.05 },
      { translateY: interpolate(Math.abs(glance.value), [0, 1], [0, -size * 0.015]) },
      { scale: 1 + focus.value * 0.14 },
      { scaleY: blink.value },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + breath.value * 0.2 + focus.value * 0.3,
    transform: [{ scale: 1.1 + breath.value * 0.1 + focus.value * 0.12 }],
  }));

  const ring = eye.ring * 2 * unit;
  const pupil = eye.pupil * 2 * unit;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="worthy-halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0.45" stopColor={colors.accent} stopOpacity={0.22} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#worthy-halo)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
        <Svg
          width={size}
          height={size}
          viewBox={`${box.x} ${box.y} ${box.size} ${box.size}`}
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id="worthy-body" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0.82} />
              <Stop offset="0.35" stopColor={colors.accent} />
              <Stop offset="1" stopColor={colors.accentPressed} />
            </LinearGradient>
          </Defs>
          {/* The tag's string, curled into a cowlick. */}
          <Path
            d="M50 8 C49 -1 60 -5 64 1 C67 6 61 10 58 6"
            fill="none"
            stroke={ink}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <Path d={worthyBodyPath} fill="url(#worthy-body)" />
          <Ellipse cx={31} cy={63} rx={4.8} ry={3.3} fill={cream} opacity={0.32} />
          <Ellipse cx={69} cy={63} rx={4.8} ry={3.3} fill={cream} opacity={0.32} />
          <Path
            d={mood === 'thinking' ? 'M45 65 Q50 63 55 65' : 'M42 63 Q50 71 58 63'}
            fill="none"
            stroke={ink}
            strokeWidth={3.4}
            strokeLinecap="round"
          />
        </Svg>
        <Animated.View
          style={[
            styles.eye,
            {
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              left: (eye.x - box.x) * unit - ring / 2,
              top: (eye.y - box.y) * unit - ring / 2,
            },
            eyeStyle,
          ]}
        >
          <View style={[styles.pupil, { width: pupil, height: pupil, borderRadius: pupil / 2 }]}>
            <View
              style={[
                styles.glint,
                {
                  width: pupil * 0.3,
                  height: pupil * 0.3,
                  borderRadius: pupil,
                  top: pupil * 0.14,
                  right: pupil * 0.14,
                },
              ]}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  eye: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cream,
  },
  pupil: {
    backgroundColor: ink,
  },
  glint: {
    position: 'absolute',
    backgroundColor: cream,
  },
});
