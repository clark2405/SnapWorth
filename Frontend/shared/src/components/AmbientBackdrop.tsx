import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { tokens, useTheme } from '../design';

export interface AmbientBackdropProps {
  /** Which hues bloom behind the screen; `value` leans on the accent, `aurora` on the brand sweep. */
  readonly mood?: 'value' | 'aurora' | 'quiet';
}

/**
 * Two soft light-pools behind the top of a screen, drifting on a slow loop so the page feels
 * lit rather than flat. Pure transform on pre-rendered gradients, so it costs nothing per frame
 * on the JS thread; under reduced motion it holds still.
 */
export function AmbientBackdrop({ mood = 'value' }: AmbientBackdropProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    drift.value = withRepeat(
      withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift, reduceMotion]);

  const first = useAnimatedStyle(() => ({
    transform: [
      { translateX: -width * 0.18 + drift.value * width * 0.12 },
      { translateY: -width * 0.3 + drift.value * 18 },
    ],
  }));
  const second = useAnimatedStyle(() => ({
    transform: [
      { translateX: width * 0.32 - drift.value * width * 0.14 },
      { translateY: -width * 0.42 + drift.value * 26 },
    ],
  }));

  if (mood === 'quiet') return null;

  const size = width * 1.2;
  const strength = isDark ? 0.34 : 0.22;
  const hues =
    mood === 'aurora'
      ? [tokens.aurora[0], tokens.aurora[5]]
      : [colors.accent, isDark ? tokens.aurora[1] : tokens.aurora[5]];

  return (
    <View style={styles.layer}>
      {hues.map((hue, index) => (
        <Animated.View
          key={hue}
          style={[
            { position: 'absolute', width: size, height: size },
            index === 0 ? first : second,
          ]}
        >
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id={`pool-${index}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={hue} stopOpacity={strength * (index === 0 ? 1 : 0.7)} />
                <Stop offset="0.55" stopColor={hue} stopOpacity={strength * 0.22} />
                <Stop offset="1" stopColor={hue} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width={size} height={size} fill={`url(#pool-${index})`} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
});
